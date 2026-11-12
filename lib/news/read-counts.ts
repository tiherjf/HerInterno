/**
 * Número de leituras por notícia, contado no banco (count exact + head).
 * Não traz as linhas de news_reads, então não sofre o limite de 1000 linhas
 * do PostgREST. Uma consulta por notícia, em paralelo; erro conta como 0.
 */

// Formato mínimo do cliente supabase-js usado aqui (permite testar sem banco).
// Tipado de forma solta de propósito: o tipo completo do SupabaseClient estoura
// a checagem estrutural do TypeScript ("excessively deep").
type CountQuery = PromiseLike<{ count: number | null; error: unknown }>;
interface CountClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export async function countReadsByNews(client: CountClient, newsIds: string[]): Promise<Record<string, number>> {
  const results = await Promise.all(
    newsIds.map(async (id) => {
      const { count, error } = await (client
        .from("news_reads")
        .select("news_id", { count: "exact", head: true })
        .eq("news_id", id) as CountQuery);
      return [id, error ? 0 : count ?? 0] as const;
    })
  );
  return Object.fromEntries(results);
}
