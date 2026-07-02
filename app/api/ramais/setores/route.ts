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
    const { name, icon, color, order_index } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const svc = createServiceClient();
    const { data, error } = await svc.from("ramal_setores").insert({
      name: name.trim(), icon: icon ?? "📞", color: color ?? "blue", order_index: order_index ?? 0,
    }).select("id").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
