export const revalidate = 60;
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff, canCreateNews } from "@/lib/auth/staff";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, FileEdit, Calendar } from "lucide-react";
import { NewsFeed } from "@/components/news/NewsFeed";
import type { StaffRole } from "@/lib/auth/staff";

const CATEGORIES = ["Todos", "Institucional", "RH", "Qualidade", "TI", "Eventos"];

type NewsItem = {
  id: string; title: string; summary: string | null;
  category: string; published_at: string | null;
  cover_url: string | null; status: string; scheduled_for: string | null;
  author_name: string | null;
};

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: { categoria?: string; pagina?: string; q?: string; aba?: string };
}) {
  const profile = await requireStaff();
  const canCreate = canCreateNews(profile.role as StaffRole);
  const isAdminOrTi = ["admin", "ti"].includes(profile.role);

  const page = parseInt(searchParams.pagina ?? "1");
  const limit = 10;
  const offset = (page - 1) * limit;
  const search = searchParams.q?.trim() ?? "";
  const aba = searchParams.aba ?? "publicadas";
  const now = new Date().toISOString();

  let feed: NewsItem[] = [];
  let drafts: NewsItem[] = [];
  let scheduled: NewsItem[] = [];
  let totalPages = 0;
  let readIds: string[] = [];

  try {
    const supabase = createClient();
    const svc = canCreate ? createServiceClient() : supabase;

    let pubQuery = svc
      .from("news")
      .select(`
        id, title, summary, category, published_at, cover_url, status, scheduled_for,
        profiles!author_id(full_name)
      `, { count: "exact" })
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

    feed = (pubData ?? []).map((item: any) => ({
      ...item,
      author_name: item.profiles?.full_name ?? null,
    }));
    totalPages = Math.ceil((count ?? 0) / limit);
    readIds = (reads ?? []).map((r: any) => r.news_id);

    if (canCreate) {
      const [{ data: draftData }, { data: schedData }] = await Promise.all([
        svc.from("news")
          .select("id, title, summary, category, published_at, cover_url, status, scheduled_for, profiles!author_id(full_name)")
          .eq("status", "draft").order("updated_at", { ascending: false }).limit(20),
        svc.from("news")
          .select("id, title, summary, category, published_at, cover_url, status, scheduled_for, profiles!author_id(full_name)")
          .eq("status", "published").gt("published_at", now)
          .order("published_at", { ascending: true }).limit(20),
      ]);
      drafts = (draftData ?? []).map((i: any) => ({ ...i, author_name: i.profiles?.full_name ?? null }));
      scheduled = (schedData ?? []).map((i: any) => ({ ...i, author_name: i.profiles?.full_name ?? null }));
    }
  } catch { /* supabase não configurado */ }

  const hasEditorContent = canCreate && (drafts.length > 0 || scheduled.length > 0);
  const activeCategory = searchParams.categoria ?? "Todos";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notícias e Comunicados</h2>
          <p className="text-muted-foreground text-sm">Fique por dentro das novidades do hospital</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/intranet/noticias/nova"><Plus size={16} /> Nova Notícia</Link>
          </Button>
        )}
      </div>

      {/* Abas de editor */}
      {hasEditorContent && (
        <div className="flex gap-1 border-b">
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

      {/* Busca + filtros (aba publicadas) */}
      {aba === "publicadas" && (
        <>
          <form method="GET" action="/intranet/noticias" className="relative max-w-150 mx-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input name="q" defaultValue={search}
              placeholder="Buscar notícias..."
              className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
            {searchParams.categoria && (
              <input type="hidden" name="categoria" value={searchParams.categoria} />
            )}
          </form>

          <div className="flex flex-wrap gap-2 max-w-150 mx-auto">
            {CATEGORIES.map(cat => (
              <Button key={cat} size="sm"
                variant={activeCategory === cat ? "default" : "outline"}
                className="rounded-full h-7 text-xs" asChild>
                <Link href={
                  cat === "Todos"
                    ? `/intranet/noticias${search ? `?q=${search}` : ""}`
                    : `/intranet/noticias?categoria=${cat}${search ? `&q=${search}` : ""}`
                }>{cat}</Link>
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Feed Instagram */}
      {aba === "publicadas" && (
        <>
          <NewsFeed
            items={feed}
            readIds={readIds}
            currentUserId={profile.id}
            isAdminOrTi={isAdminOrTi}
            canEdit={canCreate}
            emptyMessage={search ? `Nenhum resultado para "${search}"` : "Nenhuma notícia publicada ainda."}
          />

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2 max-w-150 mx-auto">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button key={p} size="sm" variant={p === page ? "default" : "outline"} asChild>
                  <Link href={`/intranet/noticias?pagina=${p}${
                    searchParams.categoria ? `&categoria=${searchParams.categoria}` : ""
                  }${search ? `&q=${search}` : ""}`}>{p}</Link>
                </Button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rascunhos */}
      {aba === "rascunhos" && canCreate && (
        <div className="space-y-3 max-w-150 mx-auto">
          {drafts.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhum rascunho salvo.</p>
          ) : drafts.map(item => (
            <div key={item.id}
              className="flex items-center justify-between gap-4 bg-white border rounded-xl px-4 py-3 hover:shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.category}</span>
                  <FileEdit size={11} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Rascunho</span>
                </div>
                <p className="font-medium truncate text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.author_name ?? "—"}</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/intranet/noticias/editar/${item.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Agendadas */}
      {aba === "agendadas" && canCreate && (
        <div className="space-y-3 max-w-150 mx-auto">
          {scheduled.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhuma notícia agendada.</p>
          ) : scheduled.map(item => (
            <div key={item.id}
              className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{item.category}</span>
                  <Calendar size={11} className="text-amber-600" />
                  <span className="text-xs text-amber-700 font-medium">
                    {item.published_at ? new Date(item.published_at).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                <p className="font-medium truncate text-sm">{item.title}</p>
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
