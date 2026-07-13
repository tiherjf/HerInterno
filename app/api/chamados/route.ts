import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { computeSlaDeadline } from "@/lib/chamados/sla";
import { agentTeam, AGENT_ROLES, CHAMADOS_TEAMS } from "@/lib/chamados/equipe";
import { erroCheckPrioridade, MSG_MIGRACAO_042 } from "@/lib/chamados/migracao";

const VALID_PRIORITIES = ["low", "medium", "high", "critical", "scheduled"];

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const view = req.nextUrl.searchParams.get("view") ?? "own";
    const status = req.nextUrl.searchParams.get("status") ?? "";
    const priority = req.nextUrl.searchParams.get("priority") ?? "";
    const category = req.nextUrl.searchParams.get("category") ?? "";
    const search = req.nextUrl.searchParams.get("q") ?? "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
    const dateFrom = req.nextUrl.searchParams.get("date_from") ?? "";
    const dateTo = req.nextUrl.searchParams.get("date_to") ?? "";
    const sector = req.nextUrl.searchParams.get("sector") ?? "";
    const responsible = req.nextUrl.searchParams.get("responsible") ?? "";
    const teamFilter = req.nextUrl.searchParams.get("team") ?? "";
    const patrimonio = req.nextUrl.searchParams.get("patrimonio") ?? "";

    const isAgent = AGENT_ROLES.includes(profile.role);
    const supabase = isAgent ? createServiceClient() : createClient();

    let query = supabase
      .from("tickets")
      .select(`
        id, number, title, priority, status, requester_name, requester_sector,
        created_at, updated_at, sla_deadline, first_response_at, resolved_at,
        rating, team, mkt_protocolo, mkt_is_alteracao, mkt_prazo_desejado,
        location, urgency, equipment_description, equipment_patrimonio,
        ticket_categories(id, name, color, sla_hours, team),
        assigned:profiles!assigned_to(id, full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isAgent || view === "own") {
      query = query.eq("requester_id", profile.id);
    } else if (view === "unassigned") {
      query = query
        .is("assigned_to", null)
        .neq("status", "closed")
        .neq("status", "cancelled");
    } else if (view === "my_assigned") {
      query = query.eq("assigned_to", profile.id);
    }

    // Escopo por equipe: agente não-admin NUNCA recebe tickets de outra equipe,
    // independente de view/parâmetros. Na view "own" ele atua como solicitante
    // (já restrito por requester_id acima, em qualquer equipe).
    const team = agentTeam(profile.role);
    if (team && isAgent && view !== "own") {
      query = query.eq("team", team);
    }

    // O parâmetro ?team= só vale para admin (e para solicitantes comuns, que já
    // estão restritos aos próprios chamados); para agente não-admin é ignorado
    // — a equipe dele já foi forçada acima.
    if (teamFilter && !(isAgent && team)) query = query.eq("team", teamFilter);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category_id", category);
    if (search) {
      // Busca ampla: título, descrição, protocolo MKT e (se numérico) número do chamado.
      // Remove caracteres reservados do PostgREST (`,` e parênteses) antes de interpolar no .or()
      const q = search.replace(/[,()]/g, "").trim();
      if (q) {
        const conds = [
          `title.ilike.%${q}%`,
          `description.ilike.%${q}%`,
          `mkt_protocolo.ilike.%${q}%`,
        ];
        if (/^\d+$/.test(q)) conds.push(`number.eq.${q}`);
        query = query.or(conds.join(","));
      }
    }
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
    if (sector) query = query.ilike("requester_sector", `%${sector}%`);
    // "me" → chamados atribuídos ao próprio usuário (filtro "Meus chamados")
    if (responsible) query = query.eq("assigned_to", responsible === "me" ? profile.id : responsible);
    if (patrimonio) query = query.eq("equipment_patrimonio", patrimonio);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tickets: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const body = await req.json();
    const {
      title, description, category_id, team: requestedTeam,
      mkt_is_alteracao, mkt_prazo_desejado,
      location, urgency, equipment_description, equipment_patrimonio,
      assigned_to,
    } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição são obrigatórios" }, { status: 400 });
    }

    const supabase = createClient();
    const svc = createServiceClient();

    let sla_deadline: string | null = null;
    let ticketTeam = (CHAMADOS_TEAMS as readonly string[]).includes(requestedTeam) ? requestedTeam : "ti";

    if (ticketTeam === "manutencao" && !location?.trim()) {
      return NextResponse.json({ error: "Localização é obrigatória para chamados de manutenção" }, { status: 400 });
    }

    // Prioridade explícita só conta se veio de fato no request; caso contrário
    // a prioridade padrão da categoria (se houver) prevalece.
    const explicitPriority =
      typeof body.priority === "string" && VALID_PRIORITIES.includes(body.priority)
        ? body.priority
        : null;
    let resolvedPriority = explicitPriority ?? "medium";

    if (category_id) {
      type Cat = {
        sla_hours: number | null;
        alteracao_sla_hours?: number | null;
        team: string | null;
        default_priority?: string | null;
      };
      // Seleção defensiva: default_priority só existe após a migração 042 —
      // se o select falhar, refaz sem as colunas novas.
      let cat: Cat | null = null;
      const comNovas = await supabase
        .from("ticket_categories")
        .select("sla_hours, alteracao_sla_hours, team, default_priority")
        .eq("id", category_id)
        .single();
      if (comNovas.error) {
        const fallback = await supabase
          .from("ticket_categories")
          .select("sla_hours, alteracao_sla_hours, team")
          .eq("id", category_id)
          .single();
        cat = fallback.data as Cat | null;
      } else {
        cat = comNovas.data as Cat | null;
      }

      if (cat?.team) ticketTeam = cat.team;
      // Prioridade automática pela categoria (quando o request não definiu uma)
      if (!explicitPriority && cat?.default_priority && VALID_PRIORITIES.includes(cat.default_priority)) {
        resolvedPriority = cat.default_priority;
      }

      // Para MKT: usa SLA de alteração se aplicável
      const slaHours = (ticketTeam === "marketing" && mkt_is_alteracao === true && cat?.alteracao_sla_hours)
        ? cat.alteracao_sla_hours
        : cat?.sla_hours;

      if (slaHours) {
        // Prazo em horas úteis (seg–sex 08:00–18:00), pulando feriados
        const deadline = await computeSlaDeadline(svc, new Date(), slaHours);
        sla_deadline = deadline.toISOString();
      }
    }

    // "A Programar" (scheduled) não corre SLA
    if (resolvedPriority === "scheduled") sla_deadline = null;

    // Direcionamento opcional a um técnico: valida que é um perfil ativo cujo
    // papel corresponde à equipe do chamado. Sem assigned_to, comportamento
    // idêntico ao anterior (o chamado entra na fila da equipe).
    let assignedTo: string | null = null;
    let assignedName: string | null = null;
    if (assigned_to) {
      const { data: tecnico } = await svc
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("id", assigned_to)
        .single();
      if (!tecnico || tecnico.active !== true || tecnico.role !== ticketTeam) {
        return NextResponse.json({ error: "Técnico inválido para esta equipe" }, { status: 400 });
      }
      assignedTo = tecnico.id;
      assignedName = tecnico.full_name;
    }

    // Gera protocolo COM-AAAA-XXXX para solicitações MKT
    let mktProtocolo: string | null = null;
    if (ticketTeam === "marketing") {
      const year = new Date().getFullYear();
      const { data: lastMkt } = await svc
        .from("tickets")
        .select("mkt_protocolo")
        .like("mkt_protocolo", `COM-${year}-%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastNum = lastMkt?.mkt_protocolo
        ? parseInt(lastMkt.mkt_protocolo.split("-").pop() ?? "0", 10)
        : 0;
      mktProtocolo = `COM-${year}-${String(lastNum + 1).padStart(4, "0")}`;
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        title: title.trim(),
        description: description.trim(),
        category_id: category_id || null,
        priority: resolvedPriority,
        team: ticketTeam,
        requester_id: profile.id,
        requester_name: profile.full_name,
        requester_sector: profile.sector || null,
        sla_deadline,
        mkt_protocolo: mktProtocolo,
        mkt_is_alteracao: ticketTeam === "marketing" ? (mkt_is_alteracao === true) : false,
        mkt_prazo_desejado: ticketTeam === "marketing" && mkt_prazo_desejado ? mkt_prazo_desejado : null,
        location: ticketTeam === "manutencao" ? (location?.trim() ?? null) : null,
        urgency: ticketTeam === "manutencao" ? (urgency ?? null) : null,
        equipment_description: ticketTeam === "manutencao" && equipment_description?.trim() ? equipment_description.trim() : null,
        equipment_patrimonio: ticketTeam === "manutencao" && equipment_patrimonio?.trim() ? equipment_patrimonio.trim() : null,
        // Direcionamento opcional — status permanece "open" e não seta first_response_at
        assigned_to: assignedTo,
      })
      .select("id, number, mkt_protocolo")
      .single();

    // Pré-migração 042: prioridade 'scheduled' fora da CHECK constraint
    if (error && erroCheckPrioridade(error)) {
      return NextResponse.json({ error: MSG_MIGRACAO_042 }, { status: 400 });
    }
    if (error) throw error;

    // Registra no histórico o direcionamento feito na abertura (melhor esforço)
    if (assignedTo && assignedName && data?.id) {
      try {
        await svc.from("ticket_history").insert({
          ticket_id: data.id,
          user_id: profile.id,
          user_name: profile.full_name,
          action: "assigned",
          old_value: null,
          new_value: `${assignedName} (direcionado na abertura)`,
        });
      } catch { /* não bloqueia a criação do chamado */ }
    }

    return NextResponse.json({ ok: true, id: data.id, number: data.number, mkt_protocolo: data.mkt_protocolo }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
