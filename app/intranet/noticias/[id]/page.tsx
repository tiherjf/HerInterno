export const revalidate = 60;
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff, canDeleteNews } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Edit, Eye, Calendar, Clock } from "lucide-react";
import { MarcarLida } from "@/components/news/MarcarLida";
import { CoverImage } from "@/components/ui-her/CoverImage";
import { readingMinutes } from "@/lib/news/reading";
import { NewsInteractions } from "@/components/news/NewsInteractions";
import { DeleteNewsButton } from "@/components/news/DeleteNewsButton";
import { LeitoresDialog } from "@/components/news/LeitoresDialog";
import type { StaffRole } from "@/lib/auth/staff";

interface NewsArticle {
  id: string; title: string; summary: string | null;
  category: string; published_at: string | null; scheduled_for: string | null;
  cover_url: string | null; body: string | null; author_id: string; status: string;
  profiles?: { full_name: string } | null;
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(iso));

export default async function NoticiaPage({ params }: { params: { id: string } }) {
  const profile = await requireStaff();
  const canEdit = await canEditMenuItem("noticias", profile.role as StaffRole);
  const canDel = canDeleteNews(profile.role as StaffRole);
  const isAdminOrTi = ["admin", "ti"].includes(profile.role);

  let news: NewsArticle | null = null;
  let readCount = 0;
  let more: { id: string; title: string; published_at: string | null }[] = [];

  try {
    // Editores veem rascunhos também
    const supabase = canEdit ? createServiceClient() : createClient();
    const query = supabase
      .from("news")
      .select("*, profiles!author_id(full_name)")
      .eq("id", params.id);

    if (!canEdit) query.eq("status", "published");

    const [{ data }, { count }, { data: moreData }] = await Promise.all([
      query.single(),
      createServiceClient()
        .from("news_reads")
        .select("*", { count: "exact", head: true })
        .eq("news_id", params.id),
      // "Mais notícias": as 4 publicadas mais recentes, sem a atual
      createClient()
        .from("news")
        .select("id, title, published_at")
        .eq("status", "published")
        .lte("published_at", new Date().toISOString())
        .neq("id", params.id)
        .order("published_at", { ascending: false })
        .limit(4),
    ]);
    news = data as NewsArticle;
    readCount = count ?? 0;
    more = moreData ?? [];
  } catch { /* supabase não configurado */ }

  if (!news) notFound();

  // Verifica se é uma notícia agendada (publicada mas no futuro)
  const now = new Date();
  const isScheduled = news.status === "published" && news.published_at
    ? new Date(news.published_at) > now
    : false;

  // Não-editores não veem agendadas
  if (isScheduled && !canEdit) notFound();

  const canEditThis = canEdit && (isAdminOrTi || news.author_id === profile.id);

  const authorName = news.profiles?.full_name ?? "Redação HER";
  const minutes = readingMinutes(news.body);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <MarcarLida newsId={params.id} />

      <div className="min-w-0 space-y-4">
        {/* Topo: voltar + leituras + ações */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/intranet/noticias"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary">
            <ArrowLeft size={16} /> Notícias
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {readCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-slate-600">
                <Eye size={13} /> {readCount} {readCount === 1 ? "leu" : "leram"}
              </span>
            )}
            {canEdit && <LeitoresDialog newsId={news.id} />}
            {canEditThis && (
              <Link href={`/intranet/noticias/editar/${news.id}`}>
                <Button variant="outline" size="sm"><Edit size={14} /> Editar</Button>
              </Link>
            )}
            {canDel && <DeleteNewsButton newsId={news.id} />}
          </div>
        </div>

        {/* Banner de rascunho/agendado */}
        {news.status === "draft" && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-800 flex items-center gap-2">
            <Edit size={14} /> <strong>Rascunho</strong> — não visível para outros colaboradores
          </div>
        )}
        {isScheduled && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
            <Calendar size={14} />
            <strong>Agendada</strong> — será publicada em{" "}
            {news.published_at ? new Date(news.published_at).toLocaleString("pt-BR") : "—"}
          </div>
        )}

        <article className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="space-y-3 p-5 sm:p-7 sm:pb-5">
            <span className="inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">
              {news.category}
            </span>
            <h1 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{news.title}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {authorName.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-slate-800">{authorName}</span>
              {news.published_at && !isScheduled && <span>· {longDate(news.published_at)}</span>}
              <span className="flex items-center gap-1">· <Clock size={13} /> {minutes} min de leitura</span>
            </div>
            {news.summary && (
              <p className="text-base leading-relaxed text-slate-600">{news.summary}</p>
            )}
          </header>

          {/* Capa inteira, com "Ampliar" */}
          {news.cover_url && (
            <CoverImage src={news.cover_url} alt={news.title} zoomable className="h-80 md:h-[28rem]" />
          )}

          <div className="space-y-6 p-5 sm:p-7">
            <div className="news-content" dangerouslySetInnerHTML={{ __html: news.body ?? "" }} />

            {/* Curtir + comentários (já abertos) */}
            {news.status === "published" && !isScheduled && (
              <NewsInteractions
                newsId={news.id}
                currentUserId={profile.id}
                isAdminOrTi={isAdminOrTi}
                defaultShowComments
              />
            )}
          </div>
        </article>
      </div>

      {/* Lateral: mais notícias */}
      {more.length > 0 && (
        <aside className="hidden lg:block">
          <section className="rounded-2xl border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Mais notícias</h3>
            <ul className="space-y-3">
              {more.map((n) => (
                <li key={n.id}>
                  <Link href={`/intranet/noticias/${n.id}`} className="group block">
                    <span className="line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-primary">{n.title}</span>
                    {n.published_at && <span className="text-xs text-slate-500">{formatDate(n.published_at)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      )}
    </div>
  );
}
