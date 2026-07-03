"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NewsInteractions } from "@/components/news/NewsInteractions";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Edit, Newspaper, ChevronDown } from "lucide-react";

interface FeedItem {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  category: string;
  published_at: string | null;
  cover_url: string | null;
  author_name: string | null;
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

function AuthorBadge({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ArticleCard({
  item, isNovo, canEdit, currentUserId, isAdminOrTi, onRead,
}: {
  item: FeedItem;
  isNovo: boolean;
  canEdit: boolean;
  currentUserId: string;
  isAdminOrTi: boolean;
  onRead: (id: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  const hasBody = !!item.body && item.body !== "<p></p>" && item.body !== "<p><br></p>";

  // Marca como lido quando 50% do card entrar no viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onRead(item.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.id, onRead]);

  return (
    <article ref={ref} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
      {/* Capa */}
      {item.cover_url && (
        <div className="relative bg-gray-100">
          <img
            src={item.cover_url}
            alt={item.title}
            className="w-full h-auto block"
          />
          {isNovo && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              NOVO
            </span>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Autor + categoria + editar */}
        <div className="flex items-center gap-2.5">
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
          {!item.cover_url && isNovo && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shrink-0">
              NOVO
            </span>
          )}
          {canEdit && (
            <Link
              href={`/intranet/noticias/editar/${item.id}`}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Editar notícia"
            >
              <Edit size={14} />
            </Link>
          )}
        </div>

        {/* Título */}
        <h2 className="text-base font-bold text-gray-900 leading-snug">
          {item.title}
        </h2>

        {/* Resumo */}
        {item.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3 italic">
            {item.summary}
          </p>
        )}

        {/* Corpo do artigo */}
        {hasBody && (
          <>
            <div className={`relative ${!expanded ? "max-h-52 overflow-hidden" : ""}`}>
              <div
                className="prose prose-sm prose-blue max-w-none tiptap-editor border-0 p-0"
                dangerouslySetInnerHTML={{ __html: item.body! }}
              />
              {!expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ChevronDown size={13} /> Ver mais
              </button>
            )}
          </>
        )}

        {/* Interações */}
        <div className="border-t pt-3">
          <NewsInteractions
            newsId={item.id}
            currentUserId={currentUserId}
            isAdminOrTi={isAdminOrTi}
          />
        </div>
      </div>
    </article>
  );
}

export function NewsFeed({
  items, readIds, currentUserId, isAdminOrTi, canEdit, emptyMessage,
}: NewsFeedProps) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const markedRef = useRef<Set<string>>(new Set(readIds));

  const isNovo = (item: FeedItem) =>
    !markedRef.current.has(item.id) &&
    !!item.published_at &&
    new Date(item.published_at) > sevenDaysAgo;

  const handleRead = useCallback(async (id: string) => {
    if (markedRef.current.has(id)) return;
    markedRef.current.add(id);
    await fetch(`/api/noticias/${id}/lida`, { method: "POST" }).catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Newspaper size={48} className="mb-3 opacity-30" />
        <p>{emptyMessage ?? "Nenhuma notícia encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-150 mx-auto space-y-5">
      {items.map(item => (
        <ArticleCard
          key={item.id}
          item={item}
          isNovo={isNovo(item)}
          canEdit={canEdit}
          currentUserId={currentUserId}
          isAdminOrTi={isAdminOrTi}
          onRead={handleRead}
        />
      ))}
    </div>
  );
}
