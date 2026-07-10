import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    await requireStaff();
    const svc = createServiceClient();

    const { data, error } = await svc
      .from("quality_audits")
      .select(`
        id, title, audit_type, scope, audit_date, status, created_at,
        auditor:auditor_id(full_name), auditor_external,
        creator:created_by(full_name)
      `)
      .order("audit_date", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ audits: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();
    const { title, audit_type, auditor_id, auditor_external, scope, audit_date } = body;

    if (!title?.trim() || !audit_type) {
      return NextResponse.json({ error: "Título e tipo são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("quality_audits")
      .insert({
        title: title.trim(),
        audit_type,
        auditor_id: auditor_id || null,
        auditor_external: auditor_external?.trim() || null,
        scope: scope?.trim() || null,
        audit_date: audit_date || null,
        status: "agendada",
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, audit: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
