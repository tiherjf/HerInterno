import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageTrainings } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!canManageTrainings(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { module_id, title, description, youtube_id, duration_minutes, order_index } = await req.json();
    if (!module_id || !title?.trim() || !youtube_id?.trim()) {
      return NextResponse.json({ error: "Módulo, título e ID do YouTube são obrigatórios" }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("trainings")
      .insert({
        module_id,
        title: title.trim(),
        description: description?.trim() ?? null,
        youtube_id: youtube_id.trim(),
        duration_minutes: duration_minutes ?? null,
        order_index: order_index ?? 0,
        active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
