import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const { error } = await supabase.from("training_progress").upsert({
      user_id: profile.id,
      training_id: params.id,
      watched_at: new Date().toISOString(),
    }, { onConflict: "user_id,training_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    await supabase.from("training_progress")
      .delete()
      .eq("user_id", profile.id)
      .eq("training_id", params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
