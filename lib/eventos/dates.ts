/** Regras puras de datas dos eventos, sempre no horário de Brasília. */

const TZ = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

/** Ano, mês e dia do calendário de São Paulo. */
function spYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * "hoje", "amanhã" ou "em N dias" (até 30 dias de calendário em SP).
 * Devolve null para evento que já começou ou que está a mais de 30 dias.
 */
export function relativeDaysLabel(eventIso: string, now: Date): string | null {
  const ev = new Date(eventIso);
  if (Number.isNaN(ev.getTime()) || ev.getTime() < now.getTime()) return null;
  const a = spYmd(now);
  const b = spYmd(ev);
  const diff = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff <= 30) return `em ${diff} dias`;
  return null;
}

export interface MonthGroup<T> {
  key: string; // "2026-11"
  label: string; // "novembro" ou "janeiro de 2027"
  items: T[];
}

/** Agrupa por mês (SP) mantendo a ordem de entrada. O ano só aparece quando difere do primeiro item. */
export function groupByMonth<T extends { event_date: string }>(items: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  let firstYear: number | null = null;
  for (const item of items) {
    const date = new Date(item.event_date);
    const { y, m } = spYmd(date);
    if (firstYear === null) firstYear = y;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const month = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "long" }).format(date);
      group = { key, label: y === firstYear ? month : `${month} de ${y}`, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
