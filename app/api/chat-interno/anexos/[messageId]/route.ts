import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { messageId: string } };

const BUCKET = "chat";
const SAFE_ID = /^[A-Za-z0-9-]+$/;

// Serve o anexo de uma mensagem via URL assinada (bucket privado).
// Acesso: apenas remetente ou destinatário da mensagem.
// Mesmo padrão de app/api/ponto/justificativas/[id]/comprovante/route.ts.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();

    if (!SAFE_ID.test(params.messageId)) {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: message } = await supabase
      .from("chat_messages")
      .select("id, sender_id, recipient_id, attachment_path")
      .eq("id", params.messageId)
      .maybeSingle();

    if (!message?.attachment_path) {
      return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
    }

    if (message.sender_id !== profile.id && message.recipient_id !== profile.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(message.attachment_path, 300);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar link do anexo" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    return apiError(err);
  }
}
