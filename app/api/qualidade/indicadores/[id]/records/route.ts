import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { reference_month, actual_value, observations } = await req.json();

    if (!reference_month || actual_value === undefined || actual_value === null) {
      return NextResponse.json({ error: "Mês e valor são obrigatórios" }, { status: 400 });
    }

    // reference_month comes as YYYY-MM → store as YYYY-MM-01
    const monthDate = reference_month.length === 7 ? `${reference_month}-01` : reference_month;

    const { data, error } = await svc
      .from("quality_indicator_records")
      .upsert({
        indicator_id: params.id,
        reference_month: monthDate,
        actual_value: Number(actual_value),
        observations: observations?.trim() || null,
        recorded_by: profile.id,
      }, { onConflict: "indicator_id,reference_month" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, record: data });
  } catch (err) {
    return apiError(err);
  }
}
