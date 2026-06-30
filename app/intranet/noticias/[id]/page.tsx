export const revalidate = 60;
import { createClient } from "@/lib/supabase/server";
import { requireStaff, canCreateNews } from "@/lib/auth/staff";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { MarcarLida } from "@/components/news/MarcarLida";

interface NewsArticle {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  published_at: string | null;
  cover_url: string | null;
  body: string | null;
  profiles?: { full_name: string } | null;
}

export default async function NoticiaPage({ params }: { params: { id: string } }) {
  const profile = await requireStaff();
  const canEdit = canCreateNews(profile.role);

  let news: NewsArticle | null = null;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("news")
      .select("*, profiles!author_id(full_name)")
      .eq("id", params.id)
      .eq("status", "published")
      .single();
    news = data as NewsArticle;
  } catch {
    // Supabase não configurado
  }

  if (!news) notFound();

  const categoryColors: Record<string, string> = {
    Institucional: "bg-blue-100 text-blue-800",
    RH: "bg-green-100 text-green-800",
    Qualidade: "bg-purple-100 text-purple-800",
    TI: "bg-yellow-100 text-yellow-800",
    Eventos: "bg-pink-100 text-pink-800",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <MarcarLida newsId={params.id} />
      <div className="flex items-center justify-between">
        <Link href="/intranet/noticias">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} /> Voltar
          </Button>
        </Link>
        {canEdit && (
          <Link href={`/intranet/noticias/editar/${params.id}`}>
            <Button variant="outline" size="sm">
              <Edit size={16} /> Editar
            </Button>
          </Link>
        )}
      </div>

      <article className="bg-white rounded-xl shadow-sm border p-8">
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium ${
              categoryColors[news.category] || "bg-gray-100 text-gray-800"
            }`}
          >
            {news.category}
          </span>
          <span className="text-sm text-muted-foreground">
            {news.published_at ? formatDate(news.published_at) : ""}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">{news.title}</h1>

        {news.summary && (
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed border-l-4 border-primary pl-4">
            {news.summary}
          </p>
        )}

        {news.cover_url && (
          <img
            src={news.cover_url}
            alt={news.title}
            className="w-full h-64 object-cover rounded-lg mb-6"
          />
        )}

        <div
          className="prose prose-blue max-w-none tiptap-editor border-0 p-0"
          dangerouslySetInnerHTML={{ __html: news.body || "" }}
        />

        <div className="mt-8 pt-6 border-t flex items-center gap-2 text-sm text-muted-foreground">
          <span>Publicado por</span>
          <span className="font-medium text-foreground">
            {(news as any).profiles?.full_name || "Redação HER"}
          </span>
        </div>
      </article>
    </div>
  );
}
