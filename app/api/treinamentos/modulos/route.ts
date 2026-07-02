import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageTrainings } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const { data: modules, error } = await supabase
      .from("training_modules")
      .select("id, name, description, cover_url, order_index")
      .eq("active", true)
      .order("order_index");

    if (error) throw error;

    // Contagem de vídeos por módulo
    const moduleIds = (modules ?? []).map(m => m.id);
    const { data: videos } = await supabase
      .from("trainings")
      .select("id, module_id")
      .in("module_id", moduleIds.length ? moduleIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("active", true);

    // Progresso do usuário
    const trainingIds = (videos ?? []).map(v => v.id);
    const { data: progress } = await supabase
      .from("training_progress")
      .select("training_id")
      .eq("user_id", profile.id)
      .in("training_id", trainingIds.length ? trainingIds : ["00000000-0000-0000-0000-000000000000"]);

    const watchedSet = new Set((progress ?? []).map(p => p.training_id));

    const enriched = (modules ?? []).map(m => {
      const moduleVideos = (videos ?? []).filter(v => v.module_id === m.id);
      const watched = moduleVideos.filter(v => watchedSet.has(v.id)).length;
      return {
        ...m,
        video_count: moduleVideos.length,
        watched_count: watched,
      };
    });

    return NextResponse.json({ modules: enriched });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!canManageTrainings(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { name, description, cover_url, order_index } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

    const svc = createServiceClient();
    const { data, error } = await svc
      .from("training_modules")
      .insert({ name: name.trim(), description: description?.trim() ?? null, cover_url: cover_url ?? null, order_index: order_index ?? 0 })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
