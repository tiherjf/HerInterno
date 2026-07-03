import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const svc = createServiceClient();

    const [{ data: nc }, { data: plans }, { data: history }] = await Promise.all([
      svc.from("quality_ncs").select(`
        *, responsible:responsible_id(id, full_name), creator:created_by(full_name)
      `).eq("id", params.id).single(),
      svc.from("quality_action_plans").select(`
        *, who:who_id(id, full_name)
      `).eq("nc_id", params.id).order("created_at"),
      svc.from("quality_nc_history").select("*").eq("nc_id", params.id).order("created_at"),
    ]);

    if (!nc) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ nc, plans: plans ?? [], history: history ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const isQuality = ["admin", "ti", "rh"].includes(profile.role);
    const svc = createServiceClient();
    const body = await req.json();

    const { data: current } = await svc.from("quality_ncs").select("status").eq("id", params.id).single();
    if (!current) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // Campos que qualquer um pode preencher ao criar (status muda apenas para quality)
    const allowed = ["title","description","category","origin","sector","severity",
      "responsible_id","occurrence_date","deadline","root_cause","immediate_action",
      "effectiveness_check","conclusion","status","cinco_porques"];

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in body) {
        if (k === "status" && !isQuality) continue; // apenas qualidade muda status
        update[k] = body[k] ?? null;
      }
    }

    const newStatus = (body.status as string | undefined) ?? current.status;
    const { error } = await svc.from("quality_ncs").update(update).eq("id", params.id);
    if (error) throw error;

    if (body.status && body.status !== current.status) {
      await svc.from("quality_nc_history").insert({
        nc_id: params.id,
        actor_id: profile.id,
        actor_name: profile.full_name,
        action: `Status alterado para "${body.status}"`,
        previous_status: current.status,
        new_status: body.status,
        note: body.note || null,
      });
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    return apiError(err);
  }
}
