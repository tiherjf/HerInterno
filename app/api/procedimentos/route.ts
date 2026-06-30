import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

const CAN_EDIT = ["admin", "ti", "marketing", "recepcao"];

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = CAN_EDIT.includes(profile.role) ? createServiceClient() : createClient();

    let query = supabase
      .from("procedimentos")
      .select("*")
      .order("unidade")
      .order("tipo")
      .order("order_num")
      .order("nome");

    if (!CAN_EDIT.includes(profile.role)) {
      query = query.eq("ativo", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ procedimentos: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!CAN_EDIT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { nome, tipo, unidade, descricao, preparacao } = await req.json();
    if (!nome?.trim() || !unidade?.trim()) {
      return NextResponse.json({ error: "Nome e unidade são obrigatórios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { count } = await supabase
      .from("procedimentos")
      .select("id", { count: "exact", head: true })
      .eq("unidade", unidade.trim())
      .eq("tipo", tipo ?? "exame");

    const { data, error } = await supabase
      .from("procedimentos")
      .insert({
        nome: nome.trim(),
        tipo: tipo ?? "exame",
        unidade: unidade.trim(),
        descricao: descricao?.trim() || null,
        preparacao: preparacao?.trim() || null,
        order_num: count ?? 0,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, procedimento: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
