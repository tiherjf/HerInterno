import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const url = new URL(req.url);
    const sector = url.searchParams.get("sector");

    let q = svc.from("quality_critical_analyses")
      .select("*, creator:created_by(full_name)")
      .order("analysis_date", { ascending: false, nullsFirst: false });
    if (sector) q = q.eq("sector", sector);

    const { data: analyses, error } = await q;
    if (error) throw error;

    let ishikawa = null;
    const ishikawaQ = svc.from("quality_ishikawa")
      .select("*, creator:created_by(full_name)")
      .order("created_at", { ascending: false });
    const { data: ish } = sector
      ? await ishikawaQ.eq("sector", sector)
      : await ishikawaQ;
    ishikawa = ish ?? [];

    return NextResponse.json({ analyses: analyses ?? [], ishikawa });
  } catch (err) { return apiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();

    if (body.type === "ishikawa") {
      if (!body.title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
      const { data, error } = await svc.from("quality_ishikawa").insert({
        title: body.title,
        sector: body.sector || null,
        nc_id: body.nc_id || null,
        analysis_id: body.analysis_id || null,
        metodo: body.metodo || [],
        mao_de_obra: body.mao_de_obra || [],
        maquina: body.maquina || [],
        material: body.material || [],
        meio_ambiente: body.meio_ambiente || [],
        medicao: body.medicao || [],
        created_by: profile.id,
      }).select().single();
      if (error) throw error;
      return NextResponse.json({ ishikawa: data }, { status: 201 });
    }

    if (!body.title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
    const { data, error } = await svc.from("quality_critical_analyses").insert({
      title: body.title,
      analysis_date: body.analysis_date || null,
      next_date: body.next_date || null,
      status: body.status || "agendada",
      participants: body.participants || [],
      agenda: body.agenda || null,
      decisions: body.decisions || null,
      observations: body.observations || null,
      sector: body.sector || null,
      created_by: profile.id,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ analysis: data }, { status: 201 });
  } catch (err) { return apiError(err); }
}
