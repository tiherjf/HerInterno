import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import {
  isMissingPlansTable,
  validatePlanPayload,
  PLAN_MANAGER_ROLES,
} from "@/lib/chamados/preventivas";

/**
 * PATCH /api/chamados/preventivas/[id]
 * Edita um plano de manutenção preventiva (inclui ativar/desativar e ajustar next_due).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requireStaff();
    if (!PLAN_MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const svc = createServiceClient();

    const result = await validatePlanPayload(svc, body, { partial: true });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (Object.keys(result.values).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("maintenance_plans")
      .update(result.values)
      .eq("id", params.id)
      .select()
      .maybeSingle();

    if (error) {
      if (isMissingPlansTable(error)) {
        return NextResponse.json({ pending_migration: true });
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, plan: data });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * DELETE /api/chamados/preventivas/[id]
 * Desativação (soft delete): marca o plano como inativo, preservando o histórico.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requireStaff();
    if (!PLAN_MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("maintenance_plans")
      .update({ active: false })
      .eq("id", params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (isMissingPlansTable(error)) {
        return NextResponse.json({ pending_migration: true });
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
