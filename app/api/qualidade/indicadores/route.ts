import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get("active") !== "false";
    const sector = url.searchParams.get("sector");

    let query = svc
      .from("quality_indicators")
      .select(`
        id, name, description, formula, unit, frequency,
        target_value, min_value, sector, category, active, created_at,
        responsible:responsible_id(full_name)
      `)
      .order("name");

    if (activeOnly) query = query.eq("active", true);
    if (sector) query = query.eq("sector", sector);

    const { data: indicators, error } = await query;
    if (error) throw error;

    // Busca os últimos 6 registros de cada indicador
    if (!indicators || indicators.length === 0) return NextResponse.json({ indicators: [] });

    const ids = indicators.map((i: { id: string }) => i.id);
    const { data: records } = await svc
      .from("quality_indicator_records")
      .select("id, indicator_id, reference_month, actual_value, observations, created_at")
      .in("indicator_id", ids)
      .order("reference_month", { ascending: false })
      .limit(ids.length * 6);

    const recordMap: Record<string, unknown[]> = {};
    for (const r of records ?? []) {
      const ir = r as { indicator_id: string };
      if (!recordMap[ir.indicator_id]) recordMap[ir.indicator_id] = [];
      recordMap[ir.indicator_id].push(r);
    }

    const result = indicators.map((ind: { id: string }) => ({
      ...ind,
      records: (recordMap[ind.id] ?? []).slice(0, 6).reverse(),
    }));

    return NextResponse.json({ indicators: result });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();
    const { name, description, formula, unit, frequency, target_value, min_value, sector, category, responsible_id } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const { data, error } = await svc
      .from("quality_indicators")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        formula: formula?.trim() || null,
        unit: unit?.trim() || "%",
        frequency: frequency || "mensal",
        target_value: target_value ?? null,
        min_value: min_value ?? null,
        sector: sector?.trim() || null,
        category: category?.trim() || null,
        responsible_id: responsible_id || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, indicator: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
