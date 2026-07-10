export const dynamic = "force-dynamic";
import { requireStaff } from "@/lib/auth/staff";
import { getMenuForRole, getMenuPermissionsForUser } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MenuPermissionsProvider } from "@/components/menu/MenuPermissionsContext";
import { MobileSidebarProvider } from "@/components/layout/MobileSidebarContext";
import { ChatProvider } from "@/components/chat/ChatProvider";

export default async function IntranetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaff();
  const role = profile.role as StaffRole;

  const [menuItems, permissions] = await Promise.all([
    getMenuForRole(role),
    getMenuPermissionsForUser(role),
  ]);

  return (
    <MenuPermissionsProvider permissions={permissions}>
      <ChatProvider me={{ id: profile.id, name: profile.full_name, sector: profile.sector ?? "" }}>
        <MobileSidebarProvider>
          <div className="flex min-h-screen bg-gray-50">
            <Sidebar
              role={profile.role}
              menuItems={menuItems}
            />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <Header profile={profile} />
              <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
        </MobileSidebarProvider>
      </ChatProvider>
    </MenuPermissionsProvider>
  );
}
