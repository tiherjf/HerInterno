import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    // Upsert: registra leitura sem duplicar
    await supabase
      .from("news_reads")
      .upsert({ user_id: profile.id, news_id: params.id }, { onConflict: "user_id,news_id" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ ok: false });
  }
}
