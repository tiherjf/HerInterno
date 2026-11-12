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
  const counts: Record<string, number> = {};
  for (const r of reads) counts[r.news_id] = (counts[r.news_id] ?? 0) + 1;
  return topFromCounts(counts, max, minItems);
}

/**
 * Ranking a partir de contagens já feitas no banco: ignora quem tem 0, ordena
 * desc (empate: ordem de entrada) e corta em `max`. Vazio se sobrarem menos de `minItems`.
 */
export function topFromCounts(
  counts: Record<string, number>,
  max: number,
  minItems: number
): { news_id: string; count: number }[] {
  const ranked = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([news_id, count]) => ({ news_id, count }))
    .sort((a, b) => b.count - a.count) // sort estável: empate mantém a ordem de entrada
    .slice(0, max);
  return ranked.length < minItems ? [] : ranked;
}
