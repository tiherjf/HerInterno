import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { validarAgenda, formatarDias, formatarHorarios, erroColunaAgenda } from "@/components/corpo-clinico/agenda";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("corpo-clinico", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["nome", "especialidade", "grupo", "unidade", "dias", "horarios", "observacoes", "sem_agenda", "ativo", "order_num"];
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    // Agenda estruturada: valida e regenera os textos legados dias/horarios
    let agendaIncluida = false;
    if ("agenda" in body) {
      const validacao = validarAgenda(body.agenda ?? null);
      if (!validacao.ok) {
        return NextResponse.json({ error: validacao.error }, { status: 400 });
      }
      updates.agenda = validacao.agenda;
      agendaIncluida = true;
      if (validacao.agenda) {
        updates.dias = formatarDias(validacao.agenda);
        updates.horarios = formatarHorarios(validacao.agenda);
      }
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("corpo_clinico")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) {
      if (agendaIncluida && erroColunaAgenda(error)) {
        return NextResponse.json(
          { error: "Execute a migração 039 no Supabase para habilitar a agenda estruturada." },
          { status: 400 }
        );
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("corpo-clinico", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    // Soft delete
    const { error } = await supabase
      .from("corpo_clinico")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
