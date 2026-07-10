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
 * GET /api/chamados/preventivas
 * Lista os planos de manutenção preventiva (ativos primeiro, por próxima execução).
 * Acesso restrito a admin/ti/manutencao — tabela sem policies de cliente (migração 041).
 */
export async function GET() {
  try {
    const profile = await requireStaff();
    if (!PLAN_MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const { data: plans, error } = await svc
      .from("maintenance_plans")
      .select("*")
      .order("active", { ascending: false })
      .order("next_due", { ascending: true });

    if (error) {
      if (isMissingPlansTable(error)) {
        return NextResponse.json({ pending_migration: true, plans: [] });
      }
      throw error;
    }

    // maintenance_plans.category_id não tem FK — junta o nome da categoria manualmente
    const categoryIds = Array.from(
      new Set((plans ?? []).map((p) => p.category_id).filter(Boolean))
    ) as string[];

    let categoriesById = new Map<string, { id: string; name: string; color: string | null }>();
    if (categoryIds.length > 0) {
      const { data: cats } = await svc
        .from("ticket_categories")
        .select("id, name, color")
        .in("id", categoryIds);
      categoriesById = new Map((cats ?? []).map((c) => [c.id as string, c]));
    }

    const enriched = (plans ?? []).map((p) => ({
      ...p,
      category: p.category_id ? (categoriesById.get(p.category_id) ?? null) : null,
    }));

    return NextResponse.json({ plans: enriched });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * POST /api/chamados/preventivas
 * Cria um plano de manutenção preventiva.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!PLAN_MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const svc = createServiceClient();

    const result = await validatePlanPayload(svc, body, { partial: false });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data, error } = await svc
      .from("maintenance_plans")
      .insert({ ...result.values, created_by: profile.id })
      .select()
      .single();

    if (error) {
      if (isMissingPlansTable(error)) {
        return NextResponse.json({ pending_migration: true }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, plan: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
