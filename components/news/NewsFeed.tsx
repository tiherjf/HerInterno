"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsInteractions } from "@/components/news/NewsInteractions";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Edit, Newspaper } from "lucide-react";

interface FeedItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  published_at: string | null;
  cover_url: string | null;
  author_name: string | null;
}

interface FullArticle extends FeedItem {
  body: string | null;
  author_id: string;
}

interface NewsFeedProps {
  items: FeedItem[];
  readIds: string[];
  currentUserId: string;
  isAdminOrTi: boolean;
  canEdit: boolean;
  emptyMessage?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Institucional: "bg-blue-100 text-blue-800",
  RH: "bg-green-100 text-green-800",
  Qualidade: "bg-purple-100 text-purple-800",
  TI: "bg-yellow-100 text-yellow-800",
  Eventos: "bg-pink-100 text-pink-800",
};

function AuthorBadge({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function NewsFeed({
  items, readIds, currentUserId, isAdminOrTi, canEdit, emptyMessage,
}: NewsFeedProps) {
  const readSet = new Set(readIds);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openId, setOpenId] = useState<string | null>(null);
  const [article, setArticle] = useState<FullArticle | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const isNovo = (item: FeedItem) =>
    !readSet.has(item.id) && !!item.published_at && new Date(item.published_at) > sevenDaysAgo;

  const openArticle = useCallback(async (id: string) => {
    setOpenId(id);
    setArticle(null);
    setLoadingArticle(true);
    try {
      const [res] = await Promise.all([
        fetch(`/api/noticias/${id}`),
        fetch(`/api/noticias/${id}/lida`, { method: "POST" }).catch(() => {}),
      ]);
      const data = await res.json();
      setArticle(data.news ?? null);
    } finally {
      setLoadingArticle(false);
    }
  }, []);

  const closeModal = () => { setOpenId(null); setArticle(null); };

  const selectedItem = items.find(i => i.id === openId);
  const coverSrc = article?.cover_url ?? selectedItem?.cover_url ?? null;
  const hasImage = !!coverSrc;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Newspaper size={48} className="mb-3 opacity-30" />
        <p>{emptyMessage ?? "Nenhuma notícia encontrada."}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── FEED ── */}
      <div className="max-w-150 mx-auto space-y-5">
        {items.map(item => (
          <article
            key={item.id}
            onClick={() => openArticle(item.id)}
            className="bg-white border rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 group"
          >
            {/* Capa */}
            {item.cover_url && (
              <div className="relative overflow-hidden aspect-video bg-gray-100">
                <img
                  src={item.cover_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
                {isNovo(item) && (
                  <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    NOVO
                  </span>
                )}
              </div>
            )}

            {/* Corpo */}
            <div className="p-4">
              {/* Autor + categoria */}
              <div className="flex items-center gap-2.5 mb-3">
                <AuthorBadge name={item.author_name ?? "R"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-none">
                    {item.author_name ?? "Redação HER"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-700"}`}>
                      {item.category}
                    </span>
                    {item.published_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(item.published_at)}
                      </span>
                    )}
                  </div>
                </div>
                {isNovo(item) && !item.cover_url && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
                    NOVO
                  </span>
                )}
              </div>

              {/* Título */}
              <h2 className="text-base font-bold text-gray-900 leading-snug mb-1.5">
                {item.title}
              </h2>

              {/* Resumo */}
              {item.summary && (
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                  {item.summary}
                </p>
              )}

              {/* Rodapé */}
              <div className="mt-3 pt-3 border-t">
                <span className="text-xs font-medium text-primary group-hover:underline">
                  Ler artigo completo →
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* ── MODAL ESTILO INSTAGRAM ── */}
      <Dialog open={!!openId} onOpenChange={v => { if (!v) closeModal(); }}>
        <DialogContent
          className={`p-0 gap-0 overflow-hidden rounded-2xl ${
            hasImage ? "max-w-4xl" : "max-w-xl"
          } max-h-[92vh] flex flex-col md:flex-row`}
        >
          {/* Esquerda — imagem (desktop) */}
          {hasImage && (
            <div className="md:w-[55%] bg-black shrink-0 flex items-center justify-center max-h-52 md:max-h-full overflow-hidden">
              <img
                src={coverSrc!}
                alt={article?.title ?? selectedItem?.title ?? ""}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Direita — conteúdo + interações */}
          <div className={`${hasImage ? "md:w-[45%]" : "w-full"} flex flex-col overflow-hidden`}>

            {loadingArticle ? (
              /* Skeleton */
              <div className="p-5 space-y-3 flex-1 overflow-y-auto">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-24 w-full mt-2" />
              </div>
            ) : article ? (
              <>
                {/* Cabeçalho fixo */}
                <div className="p-4 border-b shrink-0">
                  <div className="flex items-start gap-2.5">
                    <AuthorBadge name={article.author_name ?? "R"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {article.author_name ?? "Redação HER"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[article.category] ?? "bg-gray-100"}`}>
                          {article.category}
                        </span>
                        {article.published_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(article.published_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Link
                        href={`/intranet/noticias/editar/${article.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground p-1 rounded"
                        title="Editar"
                      >
                        <Edit size={14} />
                      </Link>
                    )}
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mt-3 leading-snug">
                    {article.title}
                  </h2>
                  {article.summary && (
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed border-l-2 border-primary/30 pl-3">
                      {article.summary}
                    </p>
                  )}
                </div>

                {/* Corpo + interações (scrollável) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {article.body && article.body !== "<p></p>" && article.body !== "<p><br></p>" && (
                    <div
                      className="prose prose-sm prose-blue max-w-none tiptap-editor border-0 p-0"
                      dangerouslySetInnerHTML={{ __html: article.body }}
                    />
                  )}

                  <NewsInteractions
                    newsId={article.id}
                    currentUserId={currentUserId}
                    isAdminOrTi={isAdminOrTi}
                  />
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
