export const revalidate = 60;
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { getAllMenuItems } from "@/lib/menu/server";
import { MenuPermissionsEditor } from "./MenuPermissionsEditor";

export default async function MenuConfigPage() {
  const profile = await requireStaff();
  if (!["admin", "ti", "marketing"].includes(profile.role)) {
    redirect("/intranet");
  }

  const items = await getAllMenuItems();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold">Permissões de Menu</h2>
        <p className="text-blue-100 text-sm mt-1">
          Defina quem pode visualizar e editar cada seção da intranet.
          Admin e TI são sempre incluídos automaticamente.
        </p>
      </div>
      <MenuPermissionsEditor items={items} />
    </div>
  );
}
