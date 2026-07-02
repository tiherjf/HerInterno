import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();
    const body = await req.json();
    const { what, why, who_id, where_loc, when_date, how, how_much } = body;

    if (!what?.trim() || !why?.trim()) {
      return NextResponse.json({ error: "O quê e Por quê são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("quality_action_plans")
      .insert({
        nc_id: params.id,
        what: what.trim(), why: why.trim(),
        who_id: who_id || null,
        where_loc: where_loc?.trim() || null,
        when_date: when_date || null,
        how: how?.trim() || null,
        how_much: how_much?.trim() || null,
        status: "pendente",
      })
      .select()
      .single();

    if (error) throw error;

    await svc.from("quality_nc_history").insert({
      nc_id: params.id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action: "Plano de ação adicionado",
    });

    return NextResponse.json({ ok: true, plan: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();
    const { plan_id, status } = await req.json();

    if (!plan_id || !status) return NextResponse.json({ error: "plan_id e status obrigatórios" }, { status: 400 });

    const { error } = await svc
      .from("quality_action_plans")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", plan_id)
      .eq("nc_id", params.id);

    if (error) throw error;

    await svc.from("quality_nc_history").insert({
      nc_id: params.id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action: `Ação marcada como "${status}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
