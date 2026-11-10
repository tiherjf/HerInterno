import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const { data: news } = await supabase
      .from("news")
      .select("id, title, summary, category, published_at, cover_url, profiles!author_id(full_name, role, avatar_url)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(8);

    // Reações apenas das notícias exibidas (antes lia a tabela inteira a cada acesso à home)
    const newsIds = (news ?? []).map((n) => n.id);
    const { data: reactions } = newsIds.length
      ? await supabase
          .from("news_reactions")
          .select("news_id, user_id")
          .in("news_id", newsIds)
      : { data: [] };

    const userLiked = new Set<string>();
    const countMap: Record<string, number> = {};
    (reactions ?? []).forEach((r: { news_id: string; user_id: string }) => {
      countMap[r.news_id] = (countMap[r.news_id] ?? 0) + 1;
      if (r.user_id === profile.id) userLiked.add(r.news_id);
    });

    const result = (news ?? []).map((n) => ({
      ...n,
      reactions_count: countMap[n.id] ?? 0,
      user_reacted: userLiked.has(n.id),
    }));

    return NextResponse.json({ news: result, userId: profile.id });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ news: [], userId: null });
  }
}
