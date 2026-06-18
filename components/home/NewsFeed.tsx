"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ArrowRight, Newspaper } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/utils";

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  published_at: string;
  cover_url: string | null;
  profiles: { full_name: string; role: string; avatar_url: string | null } | null;
  reactions_count: number;
  user_reacted: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Institucional: "bg-blue-100 text-blue-700",
  RH: "bg-green-100 text-green-700",
  Qualidade: "bg-purple-100 text-purple-700",
  TI: "bg-yellow-100 text-yellow-700",
  Eventos: "bg-pink-100 text-pink-700",
};

const CATEGORY_BG: Record<string, string> = {
  Institucional: "from-blue-500 to-blue-700",
  RH: "from-green-500 to-green-700",
  Qualidade: "from-purple-500 to-purple-700",
  TI: "from-yellow-500 to-yellow-600",
  Eventos: "from-pink-500 to-pink-700",
};

function AuthorAvatar({ name, avatarUrl, role }: { name: string; avatarUrl: string | null; role: string }) {
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-7 h-7 rounded-full brand-gradient flex items-center justify-center shrink-0 overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-[10px] font-bold">{initials}</span>
        )}
      </div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-gray-700 truncate block">{name}</span>
        <span className="text-[10px] text-gray-400">{ROLE_LABELS[role] ?? role}</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
          <div className="h-5 w-24 bg-gray-100 rounded-full" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home/feed")
      .then((r) => r.json())
      .then((d) => setNews(d.news ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleReaction(id: string) {
    // Optimistic update
    setNews((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              user_reacted: !n.user_reacted,
              reactions_count: n.user_reacted ? n.reactions_count - 1 : n.reactions_count + 1,
            }
          : n
      )
    );
    try {
      await fetch(`/api/noticias/${id}/reagir`, { method: "POST" });
    } catch {
      // Revert on error
      setNews((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                user_reacted: !n.user_reacted,
                reactions_count: n.user_reacted ? n.reactions_count - 1 : n.reactions_count + 1,
              }
            : n
        )
      );
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-white rounded-2xl border">
        <Newspaper size={40} className="mb-3 opacity-20" />
        <p>Nenhuma notícia publicada ainda.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {news.map((item) => (
        <div key={item.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow flex flex-col">
          {/* Cover */}
          <Link href={`/intranet/noticias/${item.id}`} className="block">
            {item.cover_url ? (
              <img
                src={item.cover_url}
                alt={item.title}
                className="w-full h-44 object-cover"
              />
            ) : (
              <div
                className={`w-full h-44 bg-gradient-to-br ${CATEGORY_BG[item.category] ?? "from-blue-500 to-blue-700"} flex items-center justify-center`}
              >
                <Newspaper size={40} className="text-white/50" />
              </div>
            )}
          </Link>

          {/* Content */}
          <div className="p-4 flex flex-col flex-1">
            {/* Meta */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                  CATEGORY_COLORS[item.category] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {item.category}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                {item.published_at ? formatDate(item.published_at) : ""}
              </span>
            </div>

            {/* Author */}
            {item.profiles && (
              <div className="mb-3">
                <AuthorAvatar
                  name={item.profiles.full_name}
                  avatarUrl={item.profiles.avatar_url}
                  role={item.profiles.role}
                />
              </div>
            )}

            {/* Title + Summary */}
            <Link href={`/intranet/noticias/${item.id}`} className="flex-1 group">
              <h3 className="font-bold text-gray-900 line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {item.summary && (
                <p className="text-sm text-gray-500 line-clamp-2">{item.summary}</p>
              )}
            </Link>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <button
                onClick={() => toggleReaction(item.id)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  item.user_reacted
                    ? "text-red-500"
                    : "text-gray-400 hover:text-red-400"
                }`}
              >
                <Heart
                  size={16}
                  className={item.user_reacted ? "fill-red-500" : ""}
                />
                <span className="text-xs font-medium">
                  {item.reactions_count > 0 ? item.reactions_count : "Curtir"}
                </span>
              </button>

              <Link
                href={`/intranet/noticias/${item.id}`}
                className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                Ler mais <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
