export const revalidate = 60;
import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { redirect } from "next/navigation";
import { NewsForm } from "@/components/modules/NewsForm";

export default async function NovaNoticiaPage() {
  const profile = await requireStaff();
  if (!(await canEditMenuItem("noticias", profile.role))) redirect("/intranet/noticias");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Nova Notícia</h2>
        <p className="text-muted-foreground">Crie e publique um novo comunicado</p>
      </div>
      <NewsForm authorId={profile.id} />
    </div>
  );
}
