import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { isAgentForTicket } from "@/lib/chamados/equipe";

type Params = { params: { id: string; anexoId: string } };

// Serve o anexo do chamado via URL assinada (bucket privado).
// Acesso: solicitante do chamado ou agente da equipe do chamado.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();

    const { data: attachment } = await svc
      .from("ticket_attachments")
      .select("id, ticket_id, file_url")
      .eq("id", params.anexoId)
      .eq("ticket_id", params.id)
      .maybeSingle();
    if (!attachment) {
      return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
    }

    const { data: ticket } = await svc
      .from("tickets")
      .select("requester_id, team")
      .eq("id", params.id)
      .maybeSingle();
    const isAgent = isAgentForTicket(profile.role, ticket?.team);
    if (!isAgent && ticket?.requester_id !== profile.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Anexos antigos guardavam URL pública absoluta; os novos guardam o caminho no bucket
    if (attachment.file_url.startsWith("http")) {
      return NextResponse.redirect(attachment.file_url);
    }

    const { data: signed, error } = await svc.storage
      .from("chamados")
      .createSignedUrl(attachment.file_url, 300);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar link do anexo" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    return apiError(err);
  }
}
