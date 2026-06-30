import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

// Notícias dos últimos 30 dias ainda não lidas pelo usuário
export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: recentNews }, { data: reads }] = await Promise.all([
      supabase
        .from("news")
        .select("id")
        .eq("status", "published")
        .gte("published_at", since),
      supabase
        .from("news_reads")
        .select("news_id")
        .eq("user_id", profile.id),
    ]);

    const readSet = new Set((reads ?? []).map(r => r.news_id));
    const unreadIds = (recentNews ?? []).filter(n => !readSet.has(n.id)).map(n => n.id);

    return NextResponse.json({ count: unreadIds.length, ids: unreadIds });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ count: 0, ids: [] });
  }
}
