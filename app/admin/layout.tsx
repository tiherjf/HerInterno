export const dynamic = "force-dynamic";
import { requireAdmin } from "@/lib/auth/staff";
import { getMenuForRole } from "@/lib/menu/server";
import { getMenuPermissionsForUser } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MenuPermissionsProvider } from "@/components/menu/MenuPermissionsContext";
import { ChatProvider } from "@/components/chat/ChatProvider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const role = profile.role as StaffRole;

  const [menuItems, permissions] = await Promise.all([
    getMenuForRole(role),
    getMenuPermissionsForUser(role),
  ]);

  return (
    <MenuPermissionsProvider permissions={permissions}>
      <ChatProvider me={{ id: profile.id, name: profile.full_name, sector: profile.sector ?? "" }}>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar
            role={profile.role}
            menuItems={menuItems}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header profile={profile} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </ChatProvider>
    </MenuPermissionsProvider>
  );
}
