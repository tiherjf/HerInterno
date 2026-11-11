/**
 * Regras puras da busca geral do cabeçalho (sem dependência de Next/Supabase,
 * para serem testadas com node direto).
 */

export type SearchGroupKey = "ramais" | "noticias" | "corpo-clinico" | "procedimentos" | "documentos";

export interface SearchHit {
  group: SearchGroupKey;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Ordem de exibição dos grupos; a chave de cada grupo é a mesma chave do item de menu. */
export const SEARCH_GROUPS: SearchGroupKey[] = ["ramais", "noticias", "corpo-clinico", "procedimentos", "documentos"];

export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  ramais: "Ramais",
  noticias: "Notícias",
  "corpo-clinico": "Corpo Clínico",
  procedimentos: "Procedimentos",
  documentos: "Documentos",
};

/**
 * Limpa o termo digitado. Remove caracteres que virariam curinga no ilike (% _ *),
 * ou que quebrariam o filtro or() do PostgREST (, ( ) \). Devolve null quando
 * sobram menos de 2 caracteres — aí nem se consulta o banco.
 */
export function normalizeSearchTerm(raw: string | null): string | null {
  if (!raw) return null;
  const term = raw.replace(/[%_*,()\\]/g, "").replace(/\s+/g, " ").trim();
  return term.length >= 2 ? term : null;
}

/** Só busca nos módulos que aparecem no menu do papel do usuário. */
export function searchGroupsForMenu(menuKeys: string[]): SearchGroupKey[] {
  const keys = new Set(menuKeys);
  return SEARCH_GROUPS.filter((g) => keys.has(g));
}
