import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

// GET — detalhe do ticket
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const isAgent = ["admin", "ti", "rh"].includes(profile.role);
    const supabase = isAgent ? createServiceClient() : createClient();

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(`
        *,
        ticket_categories(id, name, color, sla_hours),
        assigned:profiles!assigned_to(id, full_name),
        ticket_comments(
          id, content, is_internal, created_at, author_id, author_name
        ),
        ticket_attachments(id, file_name, file_url, file_size, created_at, uploaded_by)
      `)
      .eq("id", params.id)
      .order("created_at", { ascending: true, referencedTable: "ticket_comments" })
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Filtra comentários internos para não-agentes
    if (!isAgent && ticket.ticket_comments) {
      ticket.ticket_comments = (ticket.ticket_comments as Array<{ is_internal: boolean; author_id: string }>)
        .filter((c) => !c.is_internal || c.author_id === profile.id);
    }

    return NextResponse.json({ ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — atualiza ticket (status, assign, etc.)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const isAgent = ["admin", "ti", "rh"].includes(profile.role);
    const body = await req.json();
    const { action, ...rest } = body;

    const supabase = createServiceClient();

    // busca ticket atual
    const { data: current, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, status, requester_id, assigned_to")
      .eq("id", params.id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Requester pode apenas cancelar o próprio ticket aberto
    if (!isAgent) {
      if (action !== "cancel" || current.requester_id !== profile.id) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
      if (current.status !== "open") {
        return NextResponse.json({ error: "Apenas chamados abertos podem ser cancelados" }, { status: 400 });
      }
      const { error } = await supabase
        .from("tickets")
        .update({ status: "cancelled" })
        .eq("id", params.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // Ações para agentes
    const updates: Record<string, unknown> = {};

    if (action === "assign") {
      updates.assigned_to = rest.assigned_to ?? profile.id;
      if (current.status === "open") updates.status = "in_progress";
      if (!current.assigned_to) {
        // primeira atribuição = first_response
        updates.first_response_at = new Date().toISOString();
      }
    } else if (action === "unassign") {
      updates.assigned_to = null;
      if (current.status === "in_progress") updates.status = "open";
    } else if (action === "set_status") {
      const allowed = ["open", "in_progress", "resolved", "closed", "cancelled"];
      if (!allowed.includes(rest.status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
      updates.status = rest.status;
      if (rest.status === "resolved" || rest.status === "closed") {
        updates.resolved_at = new Date().toISOString();
        if (rest.status === "closed") updates.closed_at = new Date().toISOString();
      }
      if (rest.status === "in_progress" && !current.assigned_to) {
        updates.assigned_to = profile.id;
        updates.first_response_at = new Date().toISOString();
      }
    } else if (action === "update") {
      // atualização livre de campos permitidos
      const { priority, category_id } = rest;
      if (priority) updates.priority = priority;
      if (category_id !== undefined) updates.category_id = category_id;
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const { error } = await supabase.from("tickets").update(updates).eq("id", params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
