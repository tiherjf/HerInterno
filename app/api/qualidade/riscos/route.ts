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
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");

    let q = svc.from("quality_risks")
      .select("*, owner:owner_id(full_name), creator:created_by(full_name)")
      .order("risk_score", { ascending: false });

    if (sector) q = q.eq("sector", sector);
    if (status) q = q.eq("status", status);
    if (category) q = q.eq("category", category);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ risks: data ?? [] });
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

    if (!body.title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
    if (!body.probability || !body.impact) return NextResponse.json({ error: "Probabilidade e impacto obrigatórios" }, { status: 400 });

    const { data, error } = await svc.from("quality_risks").insert({
      title: body.title,
      description: body.description || null,
      sector: body.sector || null,
      category: body.category || "operacional",
      probability: Number(body.probability),
      impact: Number(body.impact),
      status: body.status || "identificado",
      mitigation_plan: body.mitigation_plan || null,
      owner_id: body.owner_id || null,
      created_by: profile.id,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ risk: data }, { status: 201 });
  } catch (err) { return apiError(err); }
}
