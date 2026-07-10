import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

// Serve o comprovante da justificativa via URL assinada (bucket privado).
// Acesso: dono da justificativa, gestor direto do dono ou RH/admin/ti.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();

    const { data: justification } = await supabase
      .from("justifications")
      .select("id, user_id, document_url")
      .eq("id", params.id)
      .maybeSingle();

    if (!justification?.document_url) {
      return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 });
    }

    const isRH = ["admin", "ti", "rh"].includes(profile.role);
    let allowed = isRH || justification.user_id === profile.id;
    if (!allowed && profile.is_manager) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("manager_id")
        .eq("id", justification.user_id)
        .maybeSingle();
      allowed = owner?.manager_id === profile.id;
    }
    if (!allowed) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { data: signed, error } = await supabase.storage
      .from("justificativas")
      .createSignedUrl(justification.document_url, 300);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar link do comprovante" }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    return apiError(err);
  }
}
