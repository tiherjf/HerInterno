import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MENU } from "./config";
import type { MenuItemConfig, StaffRole, UserMenuPermission } from "./types";

async function fetchAllItems(): Promise<MenuItemConfig[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("menu_permissions")
      .select("*")
      .eq("active", true)
      .order("order_num");
    if (data && data.length > 0) return data as MenuItemConfig[];
  } catch {
    // Supabase não disponível — usa defaults
  }
  return DEFAULT_MENU;
}

export async function getAllMenuItems(): Promise<MenuItemConfig[]> {
  return fetchAllItems();
}

export async function getMenuForRole(role: StaffRole): Promise<MenuItemConfig[]> {
  const items = await fetchAllItems();
  return items.filter((item) => (item.can_view as StaffRole[]).includes(role));
}

export async function getMenuPermissionsForUser(
  role: StaffRole
): Promise<UserMenuPermission[]> {
  const items = await fetchAllItems();
  return items.map((item) => ({
    key: item.key,
    canEdit: (item.can_edit as StaffRole[]).includes(role),
  }));
}

export async function canEditMenuItem(
  key: string,
  role: StaffRole
): Promise<boolean> {
  const items = await fetchAllItems();
  const item = items.find((i) => i.key === key);
  if (!item) return false;
  return (item.can_edit as StaffRole[]).includes(role);
}
