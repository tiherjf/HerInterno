export const revalidate = 60;
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff, canCreateNews, canDeleteNews } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, Newspaper, Search, FileEdit, Calendar } from "lucide-react";

const CATEGORIES = ["Todos", "Institucional", "RH", "Qualidade", "TI", "Eventos"];

const categoryVariants: Record<string, "default" | "secondary" | "outline"> = {
  Institucional: "default",
  RH: "secondary",
  Qualidade: "secondary",
  TI: "outline",
  Eventos: "secondary",
};

type NewsItem = {
  id: string; title: string; summary: string | null;
  category: string; published_at: string | null;
  cover_url: string | null; status: string; scheduled_for: string | null;
};

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: { categoria?: string; pagina?: string; q?: string; aba?: string };
}) {
  const profile = await requireStaff();
  const canCreate = canCreateNews(profile.role as StaffRole);
  const canDelete = canDeleteNews(profile.role as StaffRole);

  const page = parseInt(searchParams.pagina ?? "1");
  const limit = 12;
  const offset = (page - 1) * limit;
  const search = searchParams.q?.trim() ?? "";
  const aba = searchParams.aba ?? "publicadas";

  let news: NewsItem[] = [];
  let drafts: NewsItem[] = [];
  let scheduled: NewsItem[] = [];
  let totalPages = 0;
  let readSet = new Set<string>();

  try {
    const supabase = createClient();
    const svc = canCreate ? createServiceClient() : supabase;
    const now = new Date().toISOString();

    // Notícias publicadas (publicadas e com published_at no passado)
    let pubQuery = svc
      .from("news")
      .select("id, title, summary, category, published_at, cover_url, status, scheduled_for", { count: "exact" })
      .eq("status", "published")
      .lte("published_at", now)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (searchParams.categoria && searchParams.categoria !== "Todos") {
      pubQuery = pubQuery.eq("category", searchParams.categoria);
    }
    if (search) pubQuery = pubQuery.ilike("title", `%${search}%`);

    const [{ data: pubData, count }, { data: reads }] = await Promise.all([
      pubQuery,
      supabase.from("news_reads").select("news_id").eq("user_id", profile.id),
    ]);

    news = pubData ?? [];
    totalPages = Math.ceil((count ?? 0) / limit);
    readSet = new Set((reads ?? []).map((r: { news_id: string }) => r.news_id));

    // Rascunhos e agendados (apenas para editores)
    if (canCreate) {
      const [{ data: draftData }, { data: schedData }] = await Promise.all([
        svc.from("news").select("id, title, summary, category, published_at, cover_url, status, scheduled_for")
          .eq("status", "draft").order("updated_at", { ascending: false }).limit(20),
        svc.from("news").select("id, title, summary, category, published_at, cover_url, status, scheduled_for")
          .eq("status", "published").gt("published_at", now)
          .order("published_at", { ascending: true }).limit(20),
      ]);
      drafts = draftData ?? [];
      scheduled = schedData ?? [];
    }
  } catch { /* supabase não configurado */ }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isNovo = (item: NewsItem) =>
    !readSet.has(item.id) && !!item.published_at && new Date(item.published_at) > sevenDaysAgo;

  const activeCategory = searchParams.categoria ?? "Todos";
  const hasEditorContent = canCreate && (drafts.length > 0 || scheduled.length > 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notícias e Comunicados</h2>
          <p className="text-muted-foreground">Fique por dentro das novidades do hospital</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/intranet/noticias/nova"><Plus size={16} /> Nova Notícia</Link>
          </Button>
        )}
      </div>

      {/* Abas editor */}
      {hasEditorContent && (
        <div className="flex gap-2 border-b">
          {[
            { key: "publicadas", label: "Publicadas" },
            { key: "rascunhos", label: `Rascunhos${drafts.length > 0 ? ` (${drafts.length})` : ""}` },
            { key: "agendadas", label: `Agendadas${scheduled.length > 0 ? ` (${scheduled.length})` : ""}` },
          ].map(tab => (
            <Link key={tab.key}
              href={`/intranet/noticias?aba=${tab.key}${search ? `&q=${search}` : ""}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                aba === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      {/* Busca + filtros (apenas aba publicadas) */}
      {aba === "publicadas" && (
        <>
          <form method="GET" action="/intranet/noticias" className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar notícias..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
            {searchParams.categoria && (
              <input type="hidden" name="categoria" value={searchParams.categoria} />
            )}
          </form>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <Button key={cat} size="sm"
                variant={activeCategory === cat ? "default" : "outline"}
                className="rounded-full" asChild>
                <Link href={
                  cat === "Todos"
                    ? `/intranet/noticias${search ? `?q=${search}` : ""}`
                    : `/intranet/noticias?categoria=${cat}${search ? `&q=${search}` : ""}`
                }>
                  {cat}
                </Link>
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Grid — Publicadas */}
      {aba === "publicadas" && (
        <>
          {news.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {news.map(item => (
                <Link key={item.id} href={`/intranet/noticias/${item.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full relative">
                    {isNovo(item) && (
                      <Badge variant="destructive"
                        className="absolute top-3 right-3 z-10 animate-pulse text-[10px]">
                        NOVO
                      </Badge>
                    )}
                    {item.cover_url && (
                      <img src={item.cover_url} alt={item.title}
                        className="w-full h-40 object-cover rounded-t-lg" />
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={categoryVariants[item.category] ?? "secondary"} className="text-xs">
                          {item.category}
                        </Badge>
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
              <p className="text-lg">{search ? `Nenhum resultado para "${search}"` : "Nenhuma notícia encontrada."}</p>
              {canCreate && !search && (
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link href="/intranet/noticias/nova">Publicar primeira notícia</Link>
                </Button>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button key={p} size="sm" variant={p === page ? "default" : "outline"} asChild>
                  <Link href={`/intranet/noticias?pagina=${p}${
                    searchParams.categoria ? `&categoria=${searchParams.categoria}` : ""
                  }${search ? `&q=${search}` : ""}`}>
                    {p}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rascunhos */}
      {aba === "rascunhos" && canCreate && (
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhum rascunho salvo.</p>
          ) : drafts.map(item => (
            <div key={item.id}
              className="flex items-center justify-between gap-4 bg-white border rounded-xl px-4 py-3 hover:shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                  <FileEdit size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Rascunho</span>
                </div>
                <p className="font-medium truncate">{item.title}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/intranet/noticias/editar/${item.id}`}>Editar</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agendadas */}
      {aba === "agendadas" && canCreate && (
        <div className="space-y-3">
          {scheduled.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhuma notícia agendada.</p>
          ) : scheduled.map(item => (
            <div key={item.id}
              className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                  <Calendar size={12} className="text-amber-600" />
                  <span className="text-xs text-amber-700 font-medium">
                    Publicação: {item.published_at ? new Date(item.published_at).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                <p className="font-medium truncate">{item.title}</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/intranet/noticias/editar/${item.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
