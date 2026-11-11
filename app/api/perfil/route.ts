import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { parseBirthDate } from "@/lib/perfil/birth-date";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    // select("*"): continua funcionando antes de a migração 048 (birth_date) rodar
    const { data } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
    if (!data) return NextResponse.json({});
    const { id, full_name, role, sector, unit, phone_ext, avatar_url, birth_date } = data;
    return NextResponse.json({ id, full_name, role, sector, unit, phone_ext, avatar_url, birth_date: birth_date ?? null });
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const body = await req.json();
    const updates: Record<string, string | null> = {};
    if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
    if (body.phone_ext !== undefined) updates.phone_ext = String(body.phone_ext).trim();
    let birthDate: string | null | undefined;
    try {
      birthDate = parseBirthDate(body.birth_date);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    if (birthDate !== undefined) updates.birth_date = birthDate;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return apiError(err);
  }
}
