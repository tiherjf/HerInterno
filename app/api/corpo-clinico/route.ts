import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

const CAN_MANAGE = ["admin", "ti", "marketing", "recepcao"];

export async function GET() {
  try {
    await requireStaff();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("corpo_clinico")
      .select("*")
      .eq("ativo", true)
      .order("grupo")
      .order("order_num")
      .order("nome");
    if (error) throw error;
    return NextResponse.json({ profissionais: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!CAN_MANAGE.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const { nome, especialidade, grupo, unidade, dias, horarios, observacoes, sem_agenda } = body;

    if (!nome?.trim() || !especialidade?.trim() || !grupo?.trim()) {
      return NextResponse.json({ error: "Nome, especialidade e grupo são obrigatórios" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // order_num = próximo dentro do grupo
    const { count } = await supabase
      .from("corpo_clinico")
      .select("id", { count: "exact", head: true })
      .eq("grupo", grupo.trim())
      .eq("ativo", true);

    const { data, error } = await supabase
      .from("corpo_clinico")
      .insert({
        nome: nome.trim(),
        especialidade: especialidade.trim(),
        grupo: grupo.trim(),
        unidade: unidade?.trim() || "Hospital",
        dias: dias?.trim() || "—",
        horarios: horarios?.trim() || "—",
        observacoes: observacoes?.trim() || null,
        sem_agenda: sem_agenda ?? false,
        order_num: (count ?? 0) + 1,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, profissional: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
