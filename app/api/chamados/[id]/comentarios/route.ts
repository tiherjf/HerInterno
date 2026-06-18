import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const isAgent = ["admin", "ti", "rh"].includes(profile.role);
    const { content, is_internal = false } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Conteúdo obrigatório" }, { status: 400 });
    }

    // Apenas agentes podem criar notas internas
    if (is_internal && !isAgent) {
      return NextResponse.json({ error: "Sem permissão para notas internas" }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Verifica se o usuário tem acesso ao ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, requester_id, status")
      .eq("id", params.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
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

    return NextResponse.json({ ok: true, comment: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
