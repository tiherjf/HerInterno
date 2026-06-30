import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, sector, unit, phone_ext, avatar_url")
      .eq("id", profile.id)
      .single();
    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
    if (body.phone_ext !== undefined) updates.phone_ext = String(body.phone_ext).trim();

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)
      .select("id, full_name, phone_ext")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return apiError(err);
  }
}
