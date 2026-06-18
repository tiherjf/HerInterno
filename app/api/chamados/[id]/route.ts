import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

const IS_AGENT = ["admin", "ti", "rh", "manutencao"];

const STATUS_PT: Record<string, string> = {
  open: "Aberto", in_progress: "Em Atendimento", resolved: "Resolvido",
  closed: "Encerrado", cancelled: "Cancelado",
};
const PRIORITY_PT: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica",
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
    const isAgent = IS_AGENT.includes(profile.role);
    const supabase = isAgent ? createServiceClient() : createClient();

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
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// PATCH — atualiza ticket
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const isAgent = IS_AGENT.includes(profile.role);
    const body = await req.json();
    const { action, ...rest } = body;

    const supabase = createServiceClient();

    const { data: current, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, status, priority, requester_id, assigned_to")
      .eq("id", params.id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Ações do solicitante (não-agente)
    if (!isAgent) {
      if (action === "cancel") {
        if (current.requester_id !== profile.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
        if (current.status !== "open") return NextResponse.json({ error: "Apenas chamados abertos podem ser cancelados" }, { status: 400 });
        await supabase.from("tickets").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", params.id);
        await log(supabase, params.id, profile.id, profile.full_name, "status_changed", current.status, "cancelled");
        return NextResponse.json({ ok: true });
      }
      if (action === "reopen") {
        if (current.requester_id !== profile.id) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
        if (current.status !== "resolved") return NextResponse.json({ error: "Apenas chamados resolvidos podem ser reabertos" }, { status: 400 });
        await supabase.from("tickets").update({ status: "open", resolved_at: null, updated_at: new Date().toISOString() }).eq("id", params.id);
        await log(supabase, params.id, profile.id, profile.full_name, "reopened", "resolved", "open");
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
      const allowed = ["open", "in_progress", "resolved", "closed", "cancelled"];
      if (!allowed.includes(rest.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
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

    const { error } = await supabase.from("tickets").update(updates).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
