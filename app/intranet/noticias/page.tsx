export const revalidate = 60;
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, Newspaper } from "lucide-react";

const CATEGORIES = ["Todos", "Institucional", "RH", "Qualidade", "TI", "Eventos"];

const categoryColors: Record<string, string> = {
  Institucional: "bg-blue-100 text-blue-800",
  RH: "bg-green-100 text-green-800",
  Qualidade: "bg-purple-100 text-purple-800",
  TI: "bg-yellow-100 text-yellow-800",
  Eventos: "bg-pink-100 text-pink-800",
};

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: { categoria?: string; pagina?: string };
}) {
  const profile = await requireStaff();
  const canCreate = await canEditMenuItem("noticias", profile.role as StaffRole);

  const page = parseInt(searchParams.pagina || "1");
  const limit = 12;
  const offset = (page - 1) * limit;

  let news: { id: string; title: string; summary: string; category: string; published_at: string; cover_url: string }[] = [];
  let totalPages = 0;
  let readSet = new Set<string>();

  try {
    const supabase = createClient();
    let query = supabase
      .from("news")
      .select("id, title, summary, category, published_at, cover_url, author_id", { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchParams.categoria && searchParams.categoria !== "Todos") {
      query = query.eq("category", searchParams.categoria);
    }

    const [{ data, count }, { data: reads }] = await Promise.all([
      query,
      supabase.from("news_reads").select("news_id").eq("user_id", profile.id),
    ]);

    news = data || [];
    totalPages = Math.ceil((count || 0) / limit);
    readSet = new Set((reads ?? []).map((r: { news_id: string }) => r.news_id));
  } catch {
    // Supabase não configurado
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  function isNovo(item: { id: string; published_at: string }) {
    return (
      !readSet.has(item.id) &&
      item.published_at &&
      new Date(item.published_at) > sevenDaysAgo
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notícias e Comunicados</h2>
          <p className="text-muted-foreground">Fique por dentro das novidades do hospital</p>
        </div>
        {canCreate && (
          <Link href="/intranet/noticias/nova">
            <Button>
              <Plus size={16} /> Nova Notícia
            </Button>
          </Link>
        )}
      </div>

      {/* Filtro de categorias */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={cat === "Todos" ? "/intranet/noticias" : `/intranet/noticias?categoria=${cat}`}
          >
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                (searchParams.categoria || "Todos") === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          </Link>
        ))}
      </div>

      {/* Grid de notícias */}
      {news.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item) => (
            <Link key={item.id} href={`/intranet/noticias/${item.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
                {isNovo(item) && (
                  <span className="absolute top-3 right-3 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow animate-pulse">
                    NOVO
                  </span>
                )}
                {item.cover_url && (
                  <img
                    src={item.cover_url}
                    alt={item.title}
                    className="w-full h-40 object-cover rounded-t-lg"
                  />
                )}
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        categoryColors[item.category] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.published_at ? formatDate(item.published_at) : ""}
                    </span>
                  </div>
                  <h3 className="font-semibold line-clamp-2 mb-2">{item.title}</h3>
                  {item.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Newspaper size={48} className="mb-3 opacity-30" />
          <p className="text-lg">Nenhuma notícia encontrada.</p>
          {canCreate && (
            <Link href="/intranet/noticias/nova" className="mt-2">
              <Button variant="outline" size="sm">
                Publicar primeira notícia
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/intranet/noticias?pagina=${p}${
                searchParams.categoria ? `&categoria=${searchParams.categoria}` : ""
              }`}
            >
              <button
                className={`px-3 py-1 rounded text-sm ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
