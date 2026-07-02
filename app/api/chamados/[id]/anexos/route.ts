import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();

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
      .from("media")
      .upload(path, uint8, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = svc.storage.from("media").getPublicUrl(path);

    const { data, error } = await svc.from("ticket_attachments").insert({
      ticket_id: params.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      uploaded_by: profile.id,
    }).select("id").single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id, file_url: publicUrl }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
