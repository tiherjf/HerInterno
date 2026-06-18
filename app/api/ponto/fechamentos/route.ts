import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireStaff();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("ponto_fechamentos")
      .select("*")
      .order("reference_month", { ascending: false });
    return NextResponse.json({ fechamentos: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const { reference_month, notes } = await req.json();
    if (!reference_month || !/^\d{4}-\d{2}$/.test(reference_month)) {
      return NextResponse.json({ error: "Mês inválido (use YYYY-MM)" }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase.from("ponto_fechamentos").insert({
      reference_month,
      closed_by: profile.id,
      closed_by_name: profile.full_name,
      notes: notes?.trim() || null,
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Este mês já está fechado" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
