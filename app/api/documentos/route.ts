import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg"];

export async function GET() {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("documents")
      .select("id, title, category, sector, tags, file_url, file_type, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("documentos", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const category = (formData.get("category") as string | null)?.trim() || "Outros";
    const sector = (formData.get("sector") as string | null)?.trim() || null;
    const tagsRaw = (formData.get("tags") as string | null) ?? "";
    const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

    if (!file || !file.name) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (máximo 20MB)" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido. Use: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const svc = createServiceClient();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${sanitizedName}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await svc.storage
      .from("documentos")
      .upload(path, new Uint8Array(bytes), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    // Bucket privado: file_url guarda o caminho no storage; o download
    // passa por GET /api/documentos/[id]/download com URL assinada.
    const { data, error } = await svc.from("documents").insert({
      title,
      category,
      sector,
      tags,
      file_url: path,
      file_type: ext,
      created_by: profile.id,
    }).select("id").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
