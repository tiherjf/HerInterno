/** Termo de busca vindo de searchParams (?q= repetido chega como lista: usa o primeiro). */
export function termoDaUrl(q: string | string[] | undefined): string {
  if (Array.isArray(q)) return q[0] ?? "";
  return typeof q === "string" ? q : "";
}
