import { createClient, createServiceClient } from "@/lib/supabase/server";
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

export async function getAllMenuItemsForEditor(): Promise<MenuItemConfig[]> {
  try {
    const svc = createServiceClient();
    // Fetch all items (including inactive) for the editor
    const { data: items } = await svc
      .from("menu_permissions")
      .select("*")
      .order("order_num");

    if (!items || items.length === 0) return DEFAULT_MENU;

    // Fetch updater names separately for reliability
    const updaterIds = Array.from(new Set(items.map((i: Record<string, string | null>) => i.updated_by).filter(Boolean))) as string[];
    let updaterMap: Record<string, string> = {};
    if (updaterIds.length > 0) {
      const { data: updaters } = await svc
        .from("profiles")
        .select("id, full_name")
        .in("id", updaterIds);
      updaterMap = Object.fromEntries((updaters ?? []).map((u: { id: string; full_name: string }) => [u.id, u.full_name]));
    }

    return items.map((item: Record<string, unknown>) => ({
      ...(item as unknown as MenuItemConfig),
      updated_by_name: item.updated_by ? (updaterMap[item.updated_by as string] ?? null) : null,
    }));
  } catch {
    // fall through
  }
  return DEFAULT_MENU.map(d => ({ ...d, updated_at: null, updated_by_name: null }));
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
