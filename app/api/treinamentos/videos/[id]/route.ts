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

    const { data: video, error } = await supabase
      .from("trainings")
      .select("id, module_id, title, description, youtube_id, duration_minutes, order_index")
      .eq("id", params.id)
      .eq("active", true)
      .single();

    if (error || !video) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const { data: progress } = await supabase
      .from("training_progress")
      .select("watched_at")
      .eq("training_id", params.id)
      .eq("user_id", profile.id)
      .maybeSingle();

    return NextResponse.json({ video: { ...video, watched: !!progress, watched_at: progress?.watched_at ?? null } });
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
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() ?? null;
    if (body.youtube_id !== undefined) updates.youtube_id = body.youtube_id.trim();
    if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes ?? null;
    if (body.order_index !== undefined) updates.order_index = body.order_index;

    const svc = createServiceClient();
    const { error } = await svc.from("trainings").update(updates).eq("id", params.id);
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
    const { error } = await svc.from("trainings").update({ active: false }).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
