import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const svc = createServiceClient();

    const [{ data: audit }, { data: findings }] = await Promise.all([
      svc.from("quality_audits").select(`
        *, auditor:auditor_id(full_name), creator:created_by(full_name)
      `).eq("id", params.id).single(),
      svc.from("quality_audit_findings").select(`
        *, nc:nc_id(number, title, status)
      `).eq("audit_id", params.id).order("created_at"),
    ]);

    if (!audit) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ audit, findings: findings ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();

    const fields = ["title","audit_type","auditor_id","auditor_external","scope","audit_date","status","report"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      if (f in body) update[f] = body[f] ?? null;
    }

    const { error } = await svc.from("quality_audits").update(update).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
