import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

// Serve o documento via URL assinada (bucket privado). Qualquer staff pode baixar.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const svc = createServiceClient();

    const { data: doc } = await svc
      .from("documents")
      .select("id, file_url")
      .eq("id", params.id)
      .maybeSingle();
    if (!doc?.file_url) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    // Documentos antigos podem guardar URL absoluta
    if (doc.file_url.startsWith("http")) {
      return NextResponse.redirect(doc.file_url);
    }

    const { data: signed, error } = await svc.storage
      .from("documentos")
      .createSignedUrl(doc.file_url, 300);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar link do documento" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    return apiError(err);
  }
}
