import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { NewsFeed } from "@/components/home/NewsFeed";
import { HeroNews, type HeroNewsItem } from "@/components/home/HeroNews";
import { UpcomingEventsCard, type HomeEvent } from "@/components/home/UpcomingEventsCard";
import { BirthdaysCard } from "@/components/home/BirthdaysCard";
import { MyTicketsCard } from "@/components/home/MyTicketsCard";
import { HomeCard } from "@/components/home/HomeCard";
import {
  birthdaysOfMonth,
  formatLongDatePtBR,
  greetingFor,
  type BirthdayPerson,
} from "@/lib/home/greeting";

// Saudação e data dependem da hora; a sessão já torna a página dinâmica
export const dynamic = "force-dynamic";

/** Cada bloco da página falha sozinho: um erro vira o valor padrão em vez de derrubar a home. */
async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[inicio:${label}]`, err);
    return fallback;
  }
}

export default async function IntranetHome() {
  const profile = await requireStaff();
  const supabase = createClient();
  const now = new Date();
  const NEWS_COLS = "id, title, summary, category, cover_url";

  const [hero, events, pendingTrainings, people, openTickets] = await Promise.all([
    // Destaque: a mais recente com capa; sem nenhuma com capa, a mais recente
    safe<HeroNewsItem | null>("destaque", null, async () => {
      const [withCover, latest] = await Promise.all([
        supabase.from("news").select(NEWS_COLS).eq("status", "published").not("cover_url", "is", null)
          .order("published_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("news").select(NEWS_COLS).eq("status", "published")
          .order("published_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return (withCover.data ?? latest.data ?? null) as HeroNewsItem | null;
    }),
    safe<HomeEvent[]>("eventos", [], async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_date, location")
        .eq("active", true)
        .gte("event_date", now.toISOString())
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    }),
    safe<{ id: string; title: string; workload_hours: number }[]>("treinamentos", [], async () => {
      const { data: completed } = await supabase
        .from("training_completions")
        .select("training_id")
        .eq("user_id", profile.id);
      const ids = (completed ?? []).map((c: { training_id: string }) => c.training_id);
      const { data, error } = await supabase
        .from("trainings")
        .select("id, title, workload_hours")
        .eq("active", true)
        .not("id", "in", ids.length > 0 ? `(${ids.join(",")})` : "(null)")
        .limit(3);
      if (error) throw error;
      return data ?? [];
    }),
    // Antes da migração 048 a coluna não existe → erro → lista vazia
    safe<BirthdayPerson[]>("aniversariantes", [], async () => {
      const { data, error } = await createServiceClient()
        .from("profiles")
        .select("id, full_name, avatar_url, birth_date")
        .eq("active", true)
        .not("birth_date", "is", null);
      if (error) throw error;
      return (data ?? []) as BirthdayPerson[];
    }),
    safe<number>("chamados", 0, async () => {
      const { count, error } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("requester_id", profile.id)
        .not("status", "in", '("resolved","closed","cancelled")');
      if (error) throw error;
      return count ?? 0;
    }),
  ]);

  const firstName = profile.full_name.split(" ")[0];
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long" }).format(now);

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 md:text-[28px]">
          {greetingFor(now)}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 first-letter:uppercase">{formatLongDatePtBR(now)}</p>
      </div>

      {hero && <HeroNews news={hero} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <UpcomingEventsCard events={events} />
        <BirthdaysCard people={birthdaysOfMonth(people, now)} monthLabel={monthLabel} meuId={profile.id} />
        <MyTicketsCard openCount={openTickets} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Últimas notícias</h2>
            <Link href="/intranet/noticias" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          <NewsFeed excludeId={hero?.id} />
        </div>

        <div className="space-y-4">
          <HomeCard title="Treinamentos pendentes" icon={GraduationCap} href="/intranet/treinamentos">
            {pendingTrainings.length === 0 ? (
              <p className="text-sm text-slate-500">Você está em dia com os treinamentos.</p>
            ) : (
              <ul className="space-y-2">
                {pendingTrainings.map((tr) => (
                  <li key={tr.id}>
                    <Link
                      href={`/intranet/treinamentos/${tr.id}`}
                      className="block rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent/50"
                    >
                      <span className="block text-sm font-medium text-slate-800">{tr.title}</span>
                      <span className="text-xs text-slate-500">{tr.workload_hours}h</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </HomeCard>
        </div>
      </div>
    </div>
  );
}
