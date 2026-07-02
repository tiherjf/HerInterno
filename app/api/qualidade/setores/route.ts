import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("quality_sectors")
      .select("id, name, color, description, order_num, active, responsible:responsible_id(full_name)")
      .order("order_num");
    if (error) throw error;
    return NextResponse.json({ setores: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { name, color, description, order_num } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    const { data, error } = await svc
      .from("quality_sectors")
      .insert({ name: name.trim(), color: color || "blue", description: description?.trim() || null, order_num: order_num ?? 999 })
      .select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Já existe um setor com esse nome" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true, setor: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
