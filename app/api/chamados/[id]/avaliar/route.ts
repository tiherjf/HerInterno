import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const { rating, rating_comment } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Avaliação deve ser entre 1 e 5" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, requester_id, status, rating")
      .eq("id", params.id)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    if (ticket.requester_id !== profile.id) {
      return NextResponse.json({ error: "Só o solicitante pode avaliar" }, { status: 403 });
    }

    if (!["resolved", "closed"].includes(ticket.status)) {
      return NextResponse.json({ error: "Só é possível avaliar chamados resolvidos" }, { status: 400 });
    }

    if (ticket.rating) {
      return NextResponse.json({ error: "Este chamado já foi avaliado" }, { status: 400 });
    }

    const { error } = await supabase
      .from("tickets")
      .update({
        rating,
        rating_comment: rating_comment?.trim() ?? null,
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
