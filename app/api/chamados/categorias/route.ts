import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireStaff();
    const supabase = createClient();
    const { data } = await supabase
      .from("ticket_categories")
      .select("*")
      .eq("active", true)
      .order("name");
    return NextResponse.json({ categories: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const { name, color, sla_hours } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ticket_categories")
      .insert({ name: name.trim(), color: color ?? "#3b82f6", sla_hours: sla_hours ?? 24 })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, category: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
