"use client";

import { createContext, useContext } from "react";
import type { UserMenuPermission } from "@/lib/menu/types";

const MenuPermissionsContext = createContext<Map<string, UserMenuPermission>>(
  new Map()
);

export function MenuPermissionsProvider({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions: UserMenuPermission[];
}) {
  const map = new Map(permissions.map((p) => [p.key, p]));
  return (
    <MenuPermissionsContext.Provider value={map}>
      {children}
    </MenuPermissionsContext.Provider>
  );
}

export function useMenuPermission(key: string): UserMenuPermission {
  const map = useContext(MenuPermissionsContext);
  return map.get(key) ?? { key, canEdit: false };
}
