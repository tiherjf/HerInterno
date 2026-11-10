import { createClient } from "@/lib/supabase/server";

/** Profissionais ativos do corpo clínico — usado pela API e pela página (SSR). */
export async function getProfissionais() {
  const { data, error } = await createClient()
    .from("corpo_clinico")
    .select("*")
    .eq("ativo", true)
    .order("grupo")
    .order("order_num")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}
