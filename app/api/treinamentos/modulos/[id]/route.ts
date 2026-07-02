import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageTrainings } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const { data: mod, error } = await supabase
      .from("training_modules")
      .select("id, name, description, cover_url, order_index")
      .eq("id", params.id)
      .eq("active", true)
      .single();

    if (error || !mod) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const { data: videos } = await supabase
      .from("trainings")
      .select("id, title, description, youtube_id, duration_minutes, order_index")
      .eq("module_id", params.id)
      .eq("active", true)
      .order("order_index");

    const videoIds = (videos ?? []).map(v => v.id);
    const { data: progress } = await supabase
      .from("training_progress")
      .select("training_id")
      .eq("user_id", profile.id)
      .in("training_id", videoIds.length ? videoIds : ["00000000-0000-0000-0000-000000000000"]);

    const watchedSet = new Set((progress ?? []).map(p => p.training_id));

    return NextResponse.json({
      module: mod,
      videos: (videos ?? []).map(v => ({ ...v, watched: watchedSet.has(v.id) })),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canManageTrainings(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() ?? null;
    if (body.cover_url !== undefined) updates.cover_url = body.cover_url ?? null;
    if (body.order_index !== undefined) updates.order_index = body.order_index;
    if (body.active !== undefined) updates.active = body.active;

    const svc = createServiceClient();
    const { error } = await svc.from("training_modules").update(updates).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canManageTrainings(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { error } = await svc.from("training_modules").update({ active: false }).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
