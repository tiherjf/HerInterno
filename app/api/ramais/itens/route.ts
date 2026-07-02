import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageExtensions } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!canManageExtensions(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const { setor_id, numero, descricao, order_index } = await req.json();
    if (!setor_id || !numero?.trim() || !descricao?.trim()) {
      return NextResponse.json({ error: "Setor, número e descrição são obrigatórios" }, { status: 400 });
    }
    const svc = createServiceClient();
    const { data, error } = await svc.from("ramais").insert({
      setor_id, numero: numero.trim(), descricao: descricao.trim(), order_index: order_index ?? 0,
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
