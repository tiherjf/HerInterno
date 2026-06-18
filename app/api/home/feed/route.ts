import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const [{ data: news }, { data: myReactions }, { data: allReactions }] = await Promise.all([
      supabase
        .from("news")
        .select("id, title, summary, category, published_at, cover_url, profiles!author_id(full_name, role, avatar_url)")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(8),
      supabase
        .from("news_reactions")
        .select("news_id")
        .eq("user_id", profile.id),
      supabase
        .from("news_reactions")
        .select("news_id"),
    ]);

    const userLiked = new Set((myReactions ?? []).map((r: { news_id: string }) => r.news_id));
    const countMap: Record<string, number> = {};
    (allReactions ?? []).forEach((r: { news_id: string }) => {
      countMap[r.news_id] = (countMap[r.news_id] ?? 0) + 1;
    });

    const result = (news ?? []).map((n) => ({
      ...n,
      reactions_count: countMap[n.id] ?? 0,
      user_reacted: userLiked.has(n.id),
    }));

    return NextResponse.json({ news: result, userId: profile.id });
  } catch {
    return NextResponse.json({ news: [], userId: null });
  }
}
