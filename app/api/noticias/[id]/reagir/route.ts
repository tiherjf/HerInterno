import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const [{ data: existing }, { count }] = await Promise.all([
      supabase.from("news_reactions").select("user_id")
        .eq("user_id", profile.id).eq("news_id", params.id).maybeSingle(),
      supabase.from("news_reactions").select("*", { count: "exact", head: true })
        .eq("news_id", params.id),
    ]);
    return NextResponse.json({ liked: !!existing, count: count ?? 0 });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("news_reactions")
      .select("user_id")
      .eq("user_id", profile.id)
      .eq("news_id", params.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("news_reactions")
        .delete()
        .eq("user_id", profile.id)
        .eq("news_id", params.id);
    } else {
      await supabase
        .from("news_reactions")
        .insert({ user_id: profile.id, news_id: params.id });
    }

    const { count } = await supabase
      .from("news_reactions")
      .select("*", { count: "exact", head: true })
      .eq("news_id", params.id);

    return NextResponse.json({ liked: !existing, count: count ?? 0 });
  } catch (err) {
    return apiError(err);
  }
}
