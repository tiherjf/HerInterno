export const revalidate = 60;
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { getAllMenuItemsForEditor } from "@/lib/menu/server";
import { MenuPermissionsEditor } from "./MenuPermissionsEditor";

export default async function MenuConfigPage() {
  const profile = await requireStaff();
  // Edição de permissões de menu é exclusiva do admin
  if (profile.role !== "admin") {
    redirect("/intranet");
  }

  const items = await getAllMenuItemsForEditor();

  return (
    <div className="space-y-6">
      <div className="brand-gradient rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Permissões de Menu</h2>
        <p className="text-white/70 text-sm mt-1">
          Controle quais perfis podem visualizar e editar cada seção da intranet.
          Apenas o Admin tem acesso total fixo; os demais perfis, incluindo TI, são configuráveis.
        </p>
      </div>
      <MenuPermissionsEditor items={items} />
    </div>
  );
}
