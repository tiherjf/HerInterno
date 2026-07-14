export const revalidate = 60;
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff, canDeleteNews } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Edit, Eye, Calendar } from "lucide-react";
import { MarcarLida } from "@/components/news/MarcarLida";
import { ImageLightbox } from "@/components/news/ImageLightbox";
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

const categoryColors: Record<string, string> = {
  Institucional: "bg-blue-100 text-blue-800",
  RH: "bg-green-100 text-green-800",
  Qualidade: "bg-purple-100 text-purple-800",
  TI: "bg-yellow-100 text-yellow-800",
  Eventos: "bg-pink-100 text-pink-800",
};

export default async function NoticiaPage({ params }: { params: { id: string } }) {
  const profile = await requireStaff();
  const canEdit = await canEditMenuItem("noticias", profile.role as StaffRole);
  const canDel = canDeleteNews(profile.role as StaffRole);
  const isAdminOrTi = ["admin", "ti"].includes(profile.role);

  let news: NewsArticle | null = null;
  let readCount = 0;

  try {
    // Editores veem rascunhos também
    const supabase = canEdit ? createServiceClient() : createClient();
    const query = supabase
      .from("news")
      .select("*, profiles!author_id(full_name)")
      .eq("id", params.id);

    if (!canEdit) query.eq("status", "published");

    const [{ data }, { count }] = await Promise.all([
      query.single(),
      createServiceClient()
        .from("news_reads")
        .select("*", { count: "exact", head: true })
        .eq("news_id", params.id),
    ]);
    news = data as NewsArticle;
    readCount = count ?? 0;
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <MarcarLida newsId={params.id} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/intranet/noticias">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Voltar</Button>
        </Link>
        <div className="flex gap-2">
          {readCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-gray-100 px-3 py-1.5 rounded-full">
              <Eye size={12} /> {readCount} {readCount === 1 ? "leitura" : "leituras"}
            </span>
          )}
          {canEdit && <LeitoresDialog newsId={news.id} />}
          {canEditThis && (
            <Link href={`/intranet/noticias/editar/${news.id}`}>
              <Button variant="outline" size="sm"><Edit size={14} /> Editar</Button>
            </Link>
          )}
          {canDel && (
            <DeleteNewsButton newsId={news.id} />
          )}
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

      <article className="bg-white rounded-xl shadow-sm border p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
            categoryColors[news.category] ?? "bg-gray-100 text-gray-800"
          }`}>
            {news.category}
          </span>
          {news.published_at && !isScheduled && (
            <span className="text-sm text-muted-foreground">{formatDate(news.published_at)}</span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{news.title}</h1>

        {news.summary && (
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed border-l-4 border-primary pl-4">
            {news.summary}
          </p>
        )}

        {news.cover_url && (
          <ImageLightbox src={news.cover_url} alt={news.title}
            className="w-full h-64 object-cover rounded-lg mb-6" />
        )}

        <div className="prose prose-blue max-w-none tiptap-editor border-0 p-0"
          dangerouslySetInnerHTML={{ __html: news.body ?? "" }} />

        <div className="mt-8 pt-6 border-t flex items-center gap-2 text-sm text-muted-foreground">
          <span>Publicado por</span>
          <span className="font-medium text-foreground">
            {(news as any).profiles?.full_name ?? "Redação HER"}
          </span>
        </div>

        {/* Likes + comentários */}
        {news.status === "published" && !isScheduled && (
          <NewsInteractions
            newsId={news.id}
            currentUserId={profile.id}
            isAdminOrTi={isAdminOrTi}
          />
        )}
      </article>
    </div>
  );
}
