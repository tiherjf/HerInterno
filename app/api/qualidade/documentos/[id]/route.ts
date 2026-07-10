import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();

    const { data: current } = await svc
      .from("quality_documents")
      .select("status, version, content, file_url")
      .eq("id", params.id)
      .single();
    if (!current) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // Save old version if publishing a new one
    if (body.version && body.version !== current.version) {
      await svc.from("quality_document_versions").insert({
        document_id: params.id,
        version: current.version,
        content: current.content,
        file_url: current.file_url,
        change_note: body.change_note || null,
        changed_by: profile.id,
      });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = ["code","title","doc_type","category","version","content","file_url",
      "status","requires_reading","valid_from","valid_until"];
    for (const f of fields) {
      if (f in body) update[f] = body[f] ?? null;
    }

    if (body.status === "publicado" && current.status !== "publicado") {
      update.published_at = new Date().toISOString();
      update.approved_by = profile.id;
    }

    const { error } = await svc.from("quality_documents").update(update).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
