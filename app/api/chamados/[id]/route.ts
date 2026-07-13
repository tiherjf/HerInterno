import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { sendEmail } from "@/lib/email/resend";
import { chamadoStatusEmail } from "@/lib/email/templates/chamado-atualizado";
import { broadcastTicketUpdate } from "@/lib/chamados/realtime";
import { erroColunaChamados, erroCheckStatus, erroCheckPrioridade, MSG_MIGRACAO_042 } from "@/lib/chamados/migracao";
import { isAgentForTicket } from "@/lib/chamados/equipe";

type Params = { params: { id: string } };

const STATUS_PT: Record<string, string> = {
  open: "Aberto", in_progress: "Em Atendimento", waiting_user: "Aguardando Usuário",
  waiting_third_party: "Aguardando Terceiros",
  resolved: "Resolvido", closed: "Encerrado", cancelled: "Cancelado",
};

// Status que pausam o SLA (waiting_since ativo; só um por vez)
const WAITING_STATUSES = ["waiting_user", "waiting_third_party"];

const MSG_MIGRACAO_041 = "Execute a migração 041 no Supabase (041_chamados_melhorias.sql) para habilitar este recurso.";
const PRIORITY_PT: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica", scheduled: "A Programar",
};

async function log(
  supabase: ReturnType<typeof createServiceClient>,
  ticketId: string,
  userId: string,
  userName: string,
  action: string,
  oldVal?: string | null,
  newVal?: string | null,
) {
  await supabase.from("ticket_history").insert({
    ticket_id: ticketId,
    user_id: userId,
    user_name: userName,
    action,
    old_value: oldVal ?? null,
    new_value: newVal ?? null,
  });
}

// GET — detalhe do ticket com histórico
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(`
        *,
        ticket_categories(id, name, color, sla_hours),
        assigned:profiles!assigned_to(id, full_name),
        ticket_comments(id, content, is_internal, created_at, author_id, author_name),
        ticket_history(id, user_name, action, old_value, new_value, created_at),
        ticket_attachments(id, file_name, file_url, file_size, created_at, uploaded_by)
      `)
      .eq("id", params.id)
      .order("created_at", { ascending: true, referencedTable: "ticket_comments" })
      .order("created_at", { ascending: true, referencedTable: "ticket_history" })
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Escopo por equipe: agente só atua como agente em tickets da própria equipe;
    // fora dela é tratado como solicitante comum (só vê se for o requester)
    const isAgent = isAgentForTicket(profile.role, ticket.team);
    if (!isAgent && ticket.requester_id !== profile.id) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    if (!isAgent && ticket.ticket_comments) {
      ticket.ticket_comments = (ticket.ticket_comments as Array<{ is_internal: boolean; author_id: string }>)
        .filter(c => !c.is_internal || c.author_id === profile.id);
    }

    // Não-agentes veem apenas status_changed e reopened do histórico
    if (!isAgent && ticket.ticket_history) {
      ticket.ticket_history = (ticket.ticket_history as Array<{ action: string }>)
        .filter(h => ["status_changed", "reopened"].includes(h.action));
    }

    return NextResponse.json({ ticket });
  } catch (err) {
    return apiError(err);
  }
}

// PATCH — atualiza ticket
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const body = await req.json();
    const { action, ...rest } = body;

    const supabase = createServiceClient();

    const { data: current, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, number, title, status, priority, requester_id, assigned_to, solution, sla_deadline, team")
      .eq("id", params.id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Escopo por equipe: agente só atua como agente em tickets da própria
    // equipe; fora dela cai nas ações de solicitante (cancel/reopen próprios)
    const isAgent = isAgentForTicket(profile.role, current.team);

    // Ações do solicitante (não-agente)
    if (!isAgent) {
      if (action === "cancel") {
        if (current.requester_id !== profile.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
        if (current.status !== "open") return NextResponse.json({ error: "Apenas chamados abertos podem ser cancelados" }, { status: 400 });
        await supabase.from("tickets").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", params.id);
        await log(supabase, params.id, profile.id, profile.full_name, "status_changed", current.status, "cancelled");
        await broadcastTicketUpdate(supabase, params.id, "status");
        return NextResponse.json({ ok: true });
      }
      if (action === "reopen") {
        if (current.requester_id !== profile.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
        if (current.status !== "resolved") return NextResponse.json({ error: "Apenas chamados resolvidos podem ser reabertos" }, { status: 400 });
        await supabase.from("tickets").update({ status: "open", resolved_at: null, updated_at: new Date().toISOString() }).eq("id", params.id);
        await log(supabase, params.id, profile.id, profile.full_name, "reopened", "resolved", "open");
        await broadcastTicketUpdate(supabase, params.id, "status");
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Ações dos agentes
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === "assign") {
      const assignTo = rest.assigned_to ?? profile.id;
      updates.assigned_to = assignTo;
      if (current.status === "open") updates.status = "in_progress";
      if (!current.assigned_to) updates.first_response_at = new Date().toISOString();

      // Busca nome do assignee para o log
      const { data: assignee } = await supabase
        .from("profiles").select("full_name").eq("id", assignTo).single();
      await log(supabase, params.id, profile.id, profile.full_name,
        "assigned", current.assigned_to ? "reassigned" : null, assignee?.full_name ?? assignTo);
    } else if (action === "unassign") {
      updates.assigned_to = null;
      if (current.status === "in_progress") updates.status = "open";
      await log(supabase, params.id, profile.id, profile.full_name, "unassigned");
    } else if (action === "reopen") {
      if (!["resolved", "closed"].includes(current.status)) {
        return NextResponse.json({ error: "Apenas chamados resolvidos/encerrados podem ser reabertos" }, { status: 400 });
      }
      updates.status = "open";
      updates.resolved_at = null;
      await log(supabase, params.id, profile.id, profile.full_name, "reopened", current.status, "open");
    } else if (action === "set_status") {
      const allowed = ["open", "in_progress", "waiting_user", "waiting_third_party", "resolved", "closed", "cancelled"];
      if (!allowed.includes(rest.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

      // Pausa de SLA: saindo de um status de espera (ou trocando entre
      // waiting_user ↔ waiting_third_party), estende o SLA pelo tempo já
      // aguardado e limpa a pausa. Só há um waiting_since ativo por vez.
      if (WAITING_STATUSES.includes(current.status) && rest.status !== current.status) {
        const { data: pausa } = await supabase
          .from("tickets")
          .select("waiting_since")
          .eq("id", params.id)
          .maybeSingle();
        if (pausa?.waiting_since) {
          const aguardadoMs = Date.now() - new Date(pausa.waiting_since).getTime();
          if (current.sla_deadline && aguardadoMs > 0) {
            updates.sla_deadline = new Date(new Date(current.sla_deadline).getTime() + aguardadoMs).toISOString();
          }
          updates.waiting_since = null;
        }
      }

      // Entrando em um status de espera: (re)marca o início da pausa do SLA
      // (na troca entre esperas, sobrescreve o null acima com o novo início)
      if (WAITING_STATUSES.includes(rest.status) && rest.status !== current.status) {
        updates.waiting_since = new Date().toISOString();
      }

      // Validações obrigatórias para resolver
      if (rest.status === "resolved") {
        if (!rest.solution?.trim()) {
          return NextResponse.json({ error: "Descreva a solução antes de resolver o chamado" }, { status: 400 });
        }
        const effectiveAssignee = rest.assigned_to ?? current.assigned_to;
        if (!effectiveAssignee) {
          return NextResponse.json({ error: "Atribua o chamado a um responsável antes de resolver" }, { status: 400 });
        }
        updates.solution = rest.solution.trim();
        if (rest.assigned_to && rest.assigned_to !== current.assigned_to) {
          updates.assigned_to = rest.assigned_to;
          if (!current.assigned_to) updates.first_response_at = new Date().toISOString();
        }

        // Motivo de estouro de SLA: obrigatório ao resolver fora do prazo
        // (considera o prazo já estendido pela pausa, se for o caso)
        const breachReason = typeof rest.sla_breach_reason === "string" ? rest.sla_breach_reason.trim() : "";
        if (breachReason.length > 1000) {
          return NextResponse.json({ error: "Motivo do estouro do SLA: máximo de 1000 caracteres" }, { status: 400 });
        }
        const effectiveDeadline = (updates.sla_deadline as string | undefined) ?? current.sla_deadline;
        const slaEstourado = !!effectiveDeadline && Date.now() > new Date(effectiveDeadline).getTime();
        if (slaEstourado && !breachReason) {
          return NextResponse.json({ error: "Informe o motivo do estouro do SLA para resolver este chamado." }, { status: 400 });
        }
        if (breachReason) updates.sla_breach_reason = breachReason;

        // Materiais e custo (manutenção) — opcionais
        if (typeof rest.materials === "string" && rest.materials.trim()) {
          if (rest.materials.trim().length > 2000) {
            return NextResponse.json({ error: "Materiais: máximo de 2000 caracteres" }, { status: 400 });
          }
          updates.materials = rest.materials.trim();
        }
        if (rest.cost !== undefined && rest.cost !== null && rest.cost !== "") {
          const cost = Number(rest.cost);
          if (!Number.isFinite(cost) || cost < 0) {
            return NextResponse.json({ error: "Custo inválido — informe um valor maior ou igual a zero" }, { status: 400 });
          }
          updates.cost = cost;
        }
      }

      updates.status = rest.status;
      if (["resolved", "closed"].includes(rest.status)) updates.resolved_at = new Date().toISOString();
      if (rest.status === "closed") updates.closed_at = new Date().toISOString();
      if (rest.status === "in_progress" && !current.assigned_to) {
        updates.assigned_to = profile.id;
        updates.first_response_at = new Date().toISOString();
      }
      await log(supabase, params.id, profile.id, profile.full_name,
        "status_changed", STATUS_PT[current.status] ?? current.status, STATUS_PT[rest.status] ?? rest.status);
    } else if (action === "update") {
      const { priority, category_id } = rest;
      if (priority && priority !== current.priority) {
        updates.priority = priority;
        await log(supabase, params.id, profile.id, profile.full_name,
          "priority_changed", PRIORITY_PT[current.priority] ?? current.priority, PRIORITY_PT[priority] ?? priority);
      }
      if (category_id !== undefined) updates.category_id = category_id;
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    let { error } = await supabase.from("tickets").update(updates).eq("id", params.id);
    let aviso: string | undefined;

    // Pré-migração 041/042: materials/cost (041) ou sla_breach_reason (042)
    // inexistentes — tenta de novo sem eles para não bloquear a resolução
    const COLUNAS_041 = ["materials", "cost"];
    const COLUNAS_042 = ["sla_breach_reason"];
    const colunasNovas = [...COLUNAS_041, ...COLUNAS_042];
    if (
      error &&
      erroColunaChamados(error, colunasNovas) &&
      colunasNovas.some(c => c in updates)
    ) {
      const semNovas = { ...updates };
      for (const c of colunasNovas) delete semNovas[c];
      const retry = await supabase.from("tickets").update(semNovas).eq("id", params.id);
      error = retry.error;
      if (!error) {
        const avisos: string[] = [];
        if (COLUNAS_041.some(c => c in updates)) avisos.push("Execute a migração 041 para salvar materiais/custo");
        if (COLUNAS_042.some(c => c in updates)) {
          avisos.push("Execute a migração 042 no Supabase (042_chamados_categorias_ola.sql) para salvar o motivo do estouro do SLA");
        }
        aviso = avisos.join(" · ");
      }
    }

    // Pré-migração: waiting_since inexistente (041) ou status fora da CHECK
    // constraint ('waiting_user' → 041; 'waiting_third_party' → 042)
    if (error && (erroColunaChamados(error, ["waiting_since"]) || erroCheckStatus(error))) {
      const precisa042 = action === "set_status" && rest.status === "waiting_third_party";
      return NextResponse.json({ error: precisa042 ? MSG_MIGRACAO_042 : MSG_MIGRACAO_041 }, { status: 400 });
    }

    // Pré-migração 042: prioridade 'scheduled' fora da CHECK constraint
    if (error && erroCheckPrioridade(error)) {
      return NextResponse.json({ error: MSG_MIGRACAO_042 }, { status: 400 });
    }

    if (error) throw error;

    // Notifica o solicitante por e-mail quando o status muda (melhor esforço)
    if (
      action === "set_status" &&
      rest.status !== current.status &&
      current.requester_id &&
      current.requester_id !== profile.id
    ) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(current.requester_id);
        const email = authUser?.user?.email;
        if (email) {
          const { data: requester } = await supabase
            .from("profiles").select("full_name").eq("id", current.requester_id).single();
          const { subject, html } = chamadoStatusEmail({
            userName: requester?.full_name ?? "Colaborador",
            ticketNumber: current.number,
            ticketTitle: current.title,
            newStatus: rest.status,
            solution: rest.status === "resolved" ? rest.solution : null,
          });
          await sendEmail({ to: email, subject, html });
        }
      } catch { /* e-mail é melhor esforço — não quebra o fluxo */ }
    }

    // Notifica clientes conectados em tempo real (melhor esforço)
    await broadcastTicketUpdate(supabase, params.id, "status");

    return NextResponse.json(aviso ? { ok: true, aviso } : { ok: true });
  } catch (err) {
    return apiError(err);
  }
}
