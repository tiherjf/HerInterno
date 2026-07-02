import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const supabase = createServiceClient();
    const year = new URL(req.url).searchParams.get("year") ?? new Date().getFullYear().toString();

    const { data, error } = await supabase
      .from("ponto_feriados")
      .select("id, date, name, type, created_at")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date");

    if (error) throw error;
    return NextResponse.json({ feriados: data ?? [] });
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

    const supabase = createServiceClient();
    const { date, name, type } = await req.json();

    if (!date || !name?.trim() || !type) {
      return NextResponse.json({ error: "Data, nome e tipo são obrigatórios" }, { status: 400 });
    }

    const valid = ["nacional", "estadual", "municipal", "hospital"];
    if (!valid.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ponto_feriados")
      .insert({ date, name: name.trim(), type, created_by: profile.id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Já existe um feriado cadastrado nessa data" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, feriado: data });
  } catch (err) {
    return apiError(err);
  }
}
