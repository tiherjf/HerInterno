import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { sendEmail } from "@/lib/email/resend";
import { chamadoComentarioEmail } from "@/lib/email/templates/chamado-atualizado";
import { broadcastTicketUpdate } from "@/lib/chamados/realtime";
import { isAgentForTicket } from "@/lib/chamados/equipe";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const { content, is_internal = false } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Conteúdo obrigatório" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verifica se o usuário tem acesso ao ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, number, title, requester_id, status, team")
      .eq("id", params.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    // Escopo por equipe: agente só atua como agente em tickets da própria
    // equipe; fora dela é tratado como solicitante comum
    const isAgent = isAgentForTicket(profile.role, ticket.team);

    // Apenas agentes da equipe do chamado podem criar notas internas
    if (is_internal && !isAgent) {
      return NextResponse.json({ error: "Sem permissão para notas internas" }, { status: 403 });
    }

    if (!isAgent && ticket.requester_id !== profile.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    if (["closed", "cancelled"].includes(ticket.status) && !isAgent) {
      return NextResponse.json({ error: "Chamado encerrado" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ticket_comments")
      .insert({
        ticket_id: params.id,
        author_id: profile.id,
        author_name: profile.full_name,
        content: content.trim(),
        is_internal: isAgent ? is_internal : false,
      })
      .select()
      .single();

    if (error) throw error;

    // Solicitante respondeu um chamado em "Aguardando usuário": retoma o atendimento,
    // estende o SLA pelo tempo aguardado e limpa a pausa (melhor esforço — o status
    // waiting_user só existe após a migração 041, então as colunas estão disponíveis).
    // IMPORTANTE: só vale para waiting_user — "Aguardando Terceiros"
    // (waiting_third_party) NÃO retoma automaticamente com comentário do solicitante.
    if (!isAgent && ticket.requester_id === profile.id && ticket.status === "waiting_user") {
      try {
        const { data: pausa } = await supabase
          .from("tickets")
          .select("waiting_since, sla_deadline")
          .eq("id", params.id)
          .maybeSingle();
        const upd: Record<string, unknown> = {
          status: "in_progress",
          waiting_since: null,
          updated_at: new Date().toISOString(),
        };
        if (pausa?.waiting_since && pausa?.sla_deadline) {
          const aguardadoMs = Date.now() - new Date(pausa.waiting_since).getTime();
          if (aguardadoMs > 0) {
            upd.sla_deadline = new Date(new Date(pausa.sla_deadline).getTime() + aguardadoMs).toISOString();
          }
        }
        const { error: resumeErr } = await supabase.from("tickets").update(upd).eq("id", params.id);
        if (!resumeErr) {
          await supabase.from("ticket_history").insert({
            ticket_id: params.id,
            user_id: profile.id,
            user_name: profile.full_name,
            action: "status_changed",
            old_value: "Aguardando Usuário",
            new_value: "Em Atendimento",
          });
        }
      } catch { /* melhor esforço — o comentário já foi registrado */ }
    }

    // Primeira resposta do agente: registra first_response_at se ainda não foi
    if (isAgent) {
      const { data: existing } = await supabase
        .from("tickets")
        .select("first_response_at")
        .eq("id", params.id)
        .single();
      if (!existing?.first_response_at) {
        await supabase
          .from("tickets")
          .update({ first_response_at: new Date().toISOString() })
          .eq("id", params.id);
      }
    }

    // Notifica o solicitante por e-mail quando um agente responde (exceto notas internas
    // e respostas do próprio solicitante)
    if (isAgent && !is_internal && ticket.requester_id && ticket.requester_id !== profile.id) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(ticket.requester_id);
        const email = authUser?.user?.email;
        if (email) {
          const { data: requester } = await supabase
            .from("profiles").select("full_name").eq("id", ticket.requester_id).single();
          const { subject, html } = chamadoComentarioEmail({
            userName: requester?.full_name ?? "Colaborador",
            ticketNumber: ticket.number,
            ticketTitle: ticket.title,
            authorName: profile.full_name,
            comment: content.trim(),
          });
          await sendEmail({ to: email, subject, html });
        }
      } catch { /* e-mail é melhor esforço — não quebra o fluxo */ }
    }

    // Notifica clientes conectados em tempo real (melhor esforço)
    await broadcastTicketUpdate(supabase, params.id, "comment");

    return NextResponse.json({ ok: true, comment: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
