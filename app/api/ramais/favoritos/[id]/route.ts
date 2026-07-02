import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase.from("ramal_favoritos").upsert(
      { user_id: profile.id, ramal_id: params.id },
      { onConflict: "user_id,ramal_id" }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, favorito: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    await supabase.from("ramal_favoritos")
      .delete()
      .eq("user_id", profile.id)
      .eq("ramal_id", params.id);
    return NextResponse.json({ ok: true, favorito: false });
  } catch (err) {
    return apiError(err);
  }
}
