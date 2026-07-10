import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { validarAgenda, formatarDias, formatarHorarios, erroColunaAgenda } from "@/components/corpo-clinico/agenda";

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
    if (!(await canEditMenuItem("corpo-clinico", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const { nome, especialidade, grupo, unidade, dias, horarios, observacoes, sem_agenda, agenda } = body;

    if (!nome?.trim() || !especialidade?.trim() || !grupo?.trim()) {
      return NextResponse.json({ error: "Nome, especialidade e grupo são obrigatórios" }, { status: 400 });
    }

    // Agenda estruturada (opcional): valida e gera os textos legados dias/horarios
    const validacao = validarAgenda(agenda ?? null);
    if (!validacao.ok) {
      return NextResponse.json({ error: validacao.error }, { status: 400 });
    }
    const agendaFinal = validacao.agenda;

    const supabase = createServiceClient();

    // order_num = próximo dentro do grupo
    const { count } = await supabase
      .from("corpo_clinico")
      .select("id", { count: "exact", head: true })
      .eq("grupo", grupo.trim())
      .eq("ativo", true);

    const registro: Record<string, unknown> = {
      nome: nome.trim(),
      especialidade: especialidade.trim(),
      grupo: grupo.trim(),
      unidade: unidade?.trim() || "Clínica da Criança",
      dias: agendaFinal ? formatarDias(agendaFinal) : (dias?.trim() || "—"),
      horarios: agendaFinal ? formatarHorarios(agendaFinal) : (horarios?.trim() || "—"),
      observacoes: observacoes?.trim() || null,
      sem_agenda: sem_agenda ?? false,
      order_num: (count ?? 0) + 1,
      created_by: profile.id,
    };
    // Só envia a coluna agenda quando há valor, para não quebrar antes da migração 039
    if (agendaFinal) registro.agenda = agendaFinal;

    const { data, error } = await supabase
      .from("corpo_clinico")
      .insert(registro)
      .select()
      .single();

    if (error) {
      if (agendaFinal && erroColunaAgenda(error)) {
        return NextResponse.json(
          { error: "Execute a migração 039 no Supabase para habilitar a agenda estruturada." },
          { status: 400 }
        );
      }
      throw error;
    }
    return NextResponse.json({ ok: true, profissional: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
