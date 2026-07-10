import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

const BUCKET = "chat";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Remove caracteres problemáticos do nome do arquivo. */
function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^A-Za-z0-9._-]/g, "_");
  return base.slice(-120) || "arquivo";
}

/**
 * POST /api/chat-interno/anexos
 * Multipart com campo "file" — sobe o anexo para o bucket privado "chat"
 * em "<meu id>/<timestamp>_<nome>". A mensagem referenciando o path é
 * criada em seguida via POST /api/chat-interno/mensagens.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP." },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo excede o limite de 10MB." }, { status: 400 });
    }

    const path = `${profile.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const supabase = createServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      if (/bucket/i.test(error.message ?? "") && /not found|não encontrado/i.test(error.message ?? "")) {
        return NextResponse.json(
          { error: "Bucket 'chat' não existe. Execute: node scripts/create-chat-bucket.mjs" },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, path, name: file.name, size: file.size }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
