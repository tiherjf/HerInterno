import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const severity = url.searchParams.get("severity");
    const sector = url.searchParams.get("sector");

    let query = svc
      .from("quality_ncs")
      .select(`
        id, number, title, category, origin, sector, severity, status,
        occurrence_date, deadline, created_at, updated_at,
        responsible:responsible_id(full_name),
        creator:created_by(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && status !== "all") query = query.eq("status", status);
    if (severity && severity !== "all") query = query.eq("severity", severity);
    if (sector) query = query.ilike("sector", `%${sector}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ncs: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();
    const body = await req.json();
    const { title, description, category, origin, sector, severity, responsible_id, occurrence_date, deadline, immediate_action } = body;

    if (!title?.trim() || !category || !origin || !severity) {
      return NextResponse.json({ error: "Título, categoria, origem e gravidade são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("quality_ncs")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category, origin, sector: sector?.trim() || null, severity,
        responsible_id: responsible_id || null,
        occurrence_date: occurrence_date || null,
        deadline: deadline || null,
        immediate_action: immediate_action?.trim() || null,
        status: "aberta",
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    await svc.from("quality_nc_history").insert({
      nc_id: data.id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action: "Aberta",
      new_status: "aberta",
    });

    return NextResponse.json({ ok: true, nc: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
