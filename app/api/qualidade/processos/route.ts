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
    const type = url.searchParams.get("type");

    let q = svc.from("quality_processes")
      .select("*, owner:owner_id(full_name)")
      .order("order_num").order("created_at");

    if (sector) q = q.eq("sector", sector);
    if (type) q = q.eq("process_type", type);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ processes: data ?? [] });
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

    if (!body.name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

    const { data, error } = await svc.from("quality_processes").insert({
      name: body.name,
      description: body.description || null,
      sector: body.sector || null,
      process_type: body.process_type || "operacional",
      owner_id: body.owner_id || null,
      inputs: body.inputs || [],
      outputs: body.outputs || [],
      suppliers: body.suppliers || [],
      customers: body.customers || [],
      risks: body.risks || [],
      indicators: body.indicators || [],
      status: body.status || "ativo",
      created_by: profile.id,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ process: data }, { status: 201 });
  } catch (err) { return apiError(err); }
}
