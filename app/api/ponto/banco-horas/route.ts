import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    const isRH = ["admin", "ti", "rh"].includes(profile.role);
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const month = url.searchParams.get("month"); // YYYY-MM-DD

    let query = supabase
      .from("hour_bank")
      .select("*, profiles!user_id(full_name, sector)")
      .order("reference_month", { ascending: false });

    if (isRH && userId) {
      query = query.eq("user_id", userId);
    } else if (!isRH) {
      query = query.eq("user_id", profile.id);
    }

    if (month) query = query.eq("reference_month", month);
    query = query.limit(24);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ records: data || [] });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ records: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { user_id, reference_month, overtime_minutes, description } = await req.json();

    if (!user_id || !reference_month || overtime_minutes === undefined) {
      return NextResponse.json({ error: "user_id, reference_month e overtime_minutes são obrigatórios" }, { status: 400 });
    }

    const { error } = await supabase.from("hour_bank").upsert({
      user_id,
      reference_month,
      overtime_minutes: parseInt(overtime_minutes),
      description: description?.trim() || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,reference_month" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
