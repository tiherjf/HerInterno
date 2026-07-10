import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("documentos", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const { data: doc } = await svc
      .from("documents")
      .select("id, file_url")
      .eq("id", params.id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const { error } = await svc.from("documents").delete().eq("id", params.id);
    if (error) throw error;

    // Remove o arquivo do storage (apenas para caminhos internos, não URLs antigas)
    if (doc.file_url && !doc.file_url.startsWith("http")) {
      await svc.storage.from("documentos").remove([doc.file_url]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
