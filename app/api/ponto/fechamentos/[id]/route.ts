import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Apenas admin/TI pode reabrir períodos" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase.from("ponto_fechamentos").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
