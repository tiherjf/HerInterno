import { requireStaff, canCreateNews } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { NewsForm } from "@/components/modules/NewsForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { StaffRole } from "@/lib/auth/staff";

export default async function EditarNoticiaPage({ params }: { params: { id: string } }) {
  const profile = await requireStaff();

  if (!canCreateNews(profile.role as StaffRole)) redirect("/intranet/noticias");

  const supabase = createServiceClient();
  const { data: news } = await supabase
    .from("news")
    .select("id, title, summary, body, category, status, cover_url, author_id, published_at, scheduled_for")
    .eq("id", params.id)
    .single();

  if (!news) notFound();

  // Não-admin/ti só editam as próprias notícias
  const isAdminOrTi = ["admin", "ti"].includes(profile.role);
  if (!isAdminOrTi && news.author_id !== profile.id) redirect("/intranet/noticias");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/intranet/noticias/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Editar Notícia</h1>
          <p className="text-sm text-muted-foreground">{news.title}</p>
        </div>
      </div>

      <NewsForm
        authorId={profile.id}
        initialData={{
          id: news.id,
          title: news.title,
          summary: news.summary ?? "",
          body: news.body ?? "",
          category: news.category,
          status: news.status,
          cover_url: news.cover_url ?? "",
          scheduled_for: news.scheduled_for ?? null,
        }}
      />
    </div>
  );
}
