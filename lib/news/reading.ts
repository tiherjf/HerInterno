/** Regras puras das notícias: tempo de leitura e ranking de "Mais lidas". */

const WORDS_PER_MINUTE = 200;

/** Minutos de leitura do corpo HTML (200 palavras/min, mínimo 1). */
export function readingMinutes(html: string | null): number {
  if (!html) return 1;
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * Conta leituras por notícia e devolve as `max` mais lidas (empate: ordem da
 * primeira aparição). Lista vazia quando sobram menos de `minItems`.
 */
export function topRead(
  reads: { news_id: string }[],
  max: number,
  minItems: number
): { news_id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reads) counts.set(r.news_id, (counts.get(r.news_id) ?? 0) + 1);
  const ranked = Array.from(counts, ([news_id, count]) => ({ news_id, count }))
    .sort((a, b) => b.count - a.count) // sort estável: empate mantém a ordem de aparição
    .slice(0, max);
  return ranked.length < minItems ? [] : ranked;
}
