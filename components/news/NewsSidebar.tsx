import Link from "next/link";
import { Eye, TrendingUp } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { topRead } from "@/lib/news/reading";
import { UpcomingEventsCard, type HomeEvent } from "@/components/home/UpcomingEventsCard";
import { HomeCard } from "@/components/home/HomeCard";

const WINDOW_DAYS = 60;

async function mostRead(): Promise<{ id: string; title: string; count: number }[]> {
  try {
    const svc = createServiceClient();
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
    const { data: news } = await svc
      .from("news")
      .select("id, title")
      .eq("status", "published")
      .lte("published_at", now.toISOString())
      .gte("published_at", since);
    if (!news?.length) return [];
    const { data: reads } = await svc
      .from("news_reads")
      .select("news_id")
      .in("news_id", news.map((n) => n.id));
    const titles = new Map(news.map((n) => [n.id, n.title as string]));
    return topRead(reads ?? [], 5, 2).map((r) => ({ id: r.news_id, title: titles.get(r.news_id) ?? "", count: r.count }));
  } catch {
    return [];
  }
}

async function nextEvents(): Promise<HomeEvent[]> {
  try {
    const { data } = await createServiceClient()
      .from("events")
      .select("id, title, event_date, location")
      .eq("active", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3);
    return (data ?? []) as HomeEvent[];
  } catch {
    return [];
  }
}

/** Coluna lateral da lista de notícias. Cada bloco falha sozinho e some. */
export async function NewsSidebar() {
  const [top, events] = await Promise.all([mostRead(), nextEvents()]);

  return (
    <div className="space-y-5">
      {top.length > 0 && (
        <HomeCard title="Mais lidas" icon={TrendingUp}>
          <ol className="space-y-3">
            {top.map((n, i) => (
              <li key={n.id} className="flex gap-3">
                <span className="w-4 shrink-0 text-sm font-bold text-primary">{i + 1}</span>
                <Link href={`/intranet/noticias/${n.id}`} className="group min-w-0">
                  <span className="line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-primary">
                    {n.title}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Eye size={11} /> {n.count} {n.count === 1 ? "leitura" : "leituras"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </HomeCard>
      )}
      {events.length > 0 && <UpcomingEventsCard events={events} />}
    </div>
  );
}
