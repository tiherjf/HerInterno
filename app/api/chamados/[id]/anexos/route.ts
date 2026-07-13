import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { broadcastTicketUpdate } from "@/lib/chamados/realtime";
import { isAgentForTicket } from "@/lib/chamados/equipe";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();

    // Só o solicitante do chamado ou um agente da equipe do chamado pode anexar
    const { data: ticket } = await svc
      .from("tickets")
      .select("id, requester_id, team")
      .eq("id", params.id)
      .maybeSingle();
    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }
    const isAgent = isAgentForTicket(profile.role, ticket.team);
    if (!isAgent && ticket.requester_id !== profile.id) {
      return NextResponse.json({ error: "Sem permissão para anexar neste chamado" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (máximo 10MB)" }, { status: 400 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `tickets/${params.id}/${Date.now()}_${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await svc.storage
      .from("chamados")
      .upload(path, uint8, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    // Bucket privado: file_url guarda o caminho no storage; o download
    // passa por GET /api/chamados/[id]/anexos/[anexoId] com URL assinada.
    const { data, error } = await svc.from("ticket_attachments").insert({
      ticket_id: params.id,
      file_name: file.name,
      file_url: path,
      file_size: file.size,
      uploaded_by: profile.id,
    }).select("id").single();

    if (error) throw error;

    // Notifica clientes conectados em tempo real (melhor esforço)
    await broadcastTicketUpdate(svc, params.id, "attachment");

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
