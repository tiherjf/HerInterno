import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { finding_type, description, sector, create_nc, nc_severity, nc_category, nc_origin } = await req.json();

    if (!finding_type || !description?.trim()) {
      return NextResponse.json({ error: "Tipo e descrição são obrigatórios" }, { status: 400 });
    }

    let ncId: string | null = null;

    // Auto-create NC if requested and type is NC
    if (finding_type === "nc" && create_nc) {
      const { data: nc } = await svc
        .from("quality_ncs")
        .insert({
          title: description.trim().slice(0, 100),
          description: description.trim(),
          category: nc_category || "processo",
          origin: nc_origin || "auditoria_interna",
          sector: sector?.trim() || null,
          severity: nc_severity || "menor",
          status: "aberta",
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (nc) {
        ncId = nc.id;
        await svc.from("quality_nc_history").insert({
          nc_id: nc.id,
          actor_id: profile.id,
          actor_name: profile.full_name,
          action: "Aberta via achado de auditoria",
          new_status: "aberta",
        });
      }
    }

    const { data, error } = await svc
      .from("quality_audit_findings")
      .insert({
        audit_id: params.id,
        finding_type,
        description: description.trim(),
        sector: sector?.trim() || null,
        nc_id: ncId,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, finding: data, nc_id: ncId }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
