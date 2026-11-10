import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

/** Procedimentos visíveis ao usuário — editores veem também os inativos.
 *  Usado pela API e pela página (SSR). */
export async function getProcedimentos(role: StaffRole) {
  const canEdit = await canEditMenuItem("procedimentos", role);
  const supabase = canEdit ? createServiceClient() : createClient();

  let query = supabase
    .from("procedimentos")
    .select("*")
    .order("unidade")
    .order("tipo")
    .order("order_num")
    .order("nome");

  if (!canEdit) {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
