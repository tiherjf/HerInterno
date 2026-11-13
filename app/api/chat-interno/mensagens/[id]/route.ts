import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { podeVerMensagem } from "@/lib/chat-interno/aviso";
import { BASE_COLUMNS, FULL_COLUMNS, SAFE_ID, erroColuna040 } from "@/lib/chat-interno/colunas";

const NAO_ENCONTRADA = { error: "Mensagem não encontrada" };

/**
 * GET /api/chat-interno/mensagens/<id>
 * Uma mensagem, só para o remetente ou o destinatário. Usada pelo ChatProvider
 * ao receber o aviso do tempo real (que não leva conteúdo).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const profile = await requireStaff();
    const id = params.id ?? "";
    if (!SAFE_ID.test(id)) return NextResponse.json(NAO_ENCONTRADA, { status: 404 });

    const supabase = createServiceClient();
    const buscar = (columns: string) =>
      supabase.from("chat_messages").select(columns).eq("id", id).maybeSingle();

    let { data, error } = await buscar(FULL_COLUMNS);
    if (error && erroColuna040(error)) ({ data, error } = await buscar(BASE_COLUMNS));
    if (error) throw error;

    const row = data as unknown as { sender_id: string; recipient_id: string } | null;
    if (!row || !podeVerMensagem(row, profile.id)) {
      return NextResponse.json(NAO_ENCONTRADA, { status: 404 });
    }

    const { data: remetente } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", row.sender_id)
      .maybeSingle();

    return NextResponse.json({
      message: { ...(data as unknown as Record<string, unknown>), sender_name: remetente?.full_name ?? "" },
    });
  } catch (err) {
    return apiError(err);
  }
}
