/** Utilitários puros da página inicial, sempre no horário de Brasília. */

const TZ = "America/Sao_Paulo";

function spParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
    day: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { hour: get("hour"), day: get("day"), month: get("month") };
}

export function greetingFor(date: Date): "Bom dia" | "Boa tarde" | "Boa noite" {
  const { hour } = spParts(date);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Ex.: "quarta-feira, 11 de novembro" */
export function formatLongDatePtBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export interface BirthdayPerson {
  id: string;
  full_name: string;
  avatar_url: string | null;
  birth_date: string | null;
}

export interface Birthday {
  id: string;
  full_name: string;
  avatar_url: string | null;
  day: number;
  isToday: boolean;
}

/** Aniversariantes do mês corrente (fuso SP), por dia. Devolve só o dia — nunca o ano. */
export function birthdaysOfMonth(people: BirthdayPerson[], now: Date): Birthday[] {
  const today = spParts(now);
  const out: Birthday[] = [];
  for (const p of people) {
    const m = p.birth_date?.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m) continue;
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month !== today.month) continue;
    out.push({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, day, isToday: day === today.day });
  }
  return out.sort((a, b) => a.day - b.day || a.full_name.localeCompare(b.full_name, "pt-BR"));
}
