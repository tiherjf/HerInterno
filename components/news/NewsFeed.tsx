"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NewsInteractions } from "@/components/news/NewsInteractions";
import { refreshNoticiasUnread } from "@/components/news/NotificacaoDot";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Edit, Newspaper, ChevronDown, Eye } from "lucide-react";
import { CoverImage } from "@/components/ui-her/CoverImage";

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
  /** Número de leituras por notícia (visível para todos). */
  readCounts?: Record<string, number>;
  emptyMessage?: string;
}

function AuthorBadge({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-white text-sm shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ArticleCard({
  item, isNovo, canEdit, currentUserId, isAdminOrTi, readCount, onRead,
}: {
  item: FeedItem;
  isNovo: boolean;
  canEdit: boolean;
  currentUserId: string;
  isAdminOrTi: boolean;
  readCount: number;
  onRead: (id: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const hasBody = !!item.body && item.body !== "<p></p>" && item.body !== "<p><br></p>";

  // "Ver mais" só quando o texto passa da altura recolhida. Reavalia quando o
  // conteúdo cresce depois (imagens do corpo, fontes carregando).
  useEffect(() => {
    const box = bodyRef.current;
    const content = box?.firstElementChild;
    if (!box || !content) return;
    const check = () => setOverflows(box.scrollHeight > box.clientHeight + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(content);
    return () => ro.disconnect();
  }, [item.body]);

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
    <article ref={ref} className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Autor + data + categoria */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <AuthorBadge name={item.author_name ?? "R"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-none">
            {item.author_name ?? "Redação HER"}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-slate-500">
            {item.published_at && <span>{formatDate(item.published_at)}</span>}
            <span className="px-2 py-0.5 rounded-full font-semibold bg-accent text-primary">{item.category}</span>
            {readCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye size={11} /> {readCount} {readCount === 1 ? "leitura" : "leituras"}
              </span>
            )}
          </div>
        </div>
        {isNovo && (
          <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
            NOVO
          </span>
        )}
        {canEdit && (
          <Link
            href={`/intranet/noticias/editar/${item.id}`}
            className="text-slate-400 hover:text-primary p-1.5 rounded-lg hover:bg-accent transition-colors"
            title="Editar notícia"
          >
            <Edit size={14} />
          </Link>
        )}
      </div>

      {/* Capa inteira (cartaz não é cortado) */}
      {item.cover_url && (
        <CoverImage src={item.cover_url} alt={item.title} zoomable className="h-80 md:h-[26rem]" />
      )}

      <div className="p-4 space-y-3">
        <h2 className="text-lg font-bold text-slate-900 leading-snug">
          <Link href={`/intranet/noticias/${item.id}`} className="hover:text-primary">
            {item.title}
          </Link>
        </h2>

        {item.summary && (
          <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>
        )}

        {/* Corpo do artigo */}
        {hasBody && (
          <>
            <div ref={bodyRef} className={`relative ${!expanded ? "max-h-52 overflow-hidden" : ""}`}>
              <div
                className="news-content"
                dangerouslySetInnerHTML={{ __html: item.body! }}
              />
              {!expanded && overflows && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
            {!expanded && overflows && (
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ChevronDown size={13} /> Ver mais
              </button>
            )}
          </>
        )}

        {/* Interações (o componente já traz a linha divisória) */}
        <NewsInteractions
          newsId={item.id}
          currentUserId={currentUserId}
          isAdminOrTi={isAdminOrTi}
        />
      </div>
    </article>
  );
}

export function NewsFeed({
  items, readIds, currentUserId, isAdminOrTi, canEdit, readCounts, emptyMessage,
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
    await fetch(`/api/noticias/${id}/lida`, { method: "POST" })
      .then(refreshNoticiasUnread)
      .catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-slate-500">
        <Newspaper size={48} className="mb-3 opacity-30" />
        <p>{emptyMessage ?? "Nenhuma notícia encontrada."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map(item => (
        <ArticleCard
          key={item.id}
          item={item}
          isNovo={isNovo(item)}
          canEdit={canEdit}
          currentUserId={currentUserId}
          isAdminOrTi={isAdminOrTi}
          readCount={readCounts?.[item.id] ?? 0}
          onRead={handleRead}
        />
      ))}
    </div>
  );
}
