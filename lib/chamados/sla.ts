import { createServiceClient } from "@/lib/supabase/server";

// Janela de horário útil: segunda a sexta, 08:00–18:00 (horário local do servidor,
// seguindo a mesma convenção de getDay() + toISOString usada em ponto/justificativas)
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;

function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false; // domingo / sábado
  const iso = date.toISOString().split("T")[0];
  return !holidays.has(iso);
}

/**
 * Núcleo puro (testável): consome `slaHours` horas úteis a partir de `start`,
 * considerando apenas as janelas seg–sex 08:00–18:00 e pulando feriados
 * (conjunto de datas YYYY-MM-DD). Se `start` estiver fora da janela útil,
 * é ajustado para o início da próxima janela.
 */
export function computeSlaDeadlineCore(start: Date, slaHours: number, holidays: Set<string>): Date {
  let remainingMs = slaHours * 3_600_000;
  const cursor = new Date(start);

  // Limite de segurança (~10 anos de dias) para evitar loop infinito
  for (let i = 0; i < 3700; i++) {
    if (!isBusinessDay(cursor, holidays) || cursor.getHours() >= BUSINESS_END_HOUR) {
      // Fora do expediente: avança para o próximo dia às 08:00
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }
    if (cursor.getHours() < BUSINESS_START_HOUR) {
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    }

    const endOfWindow = new Date(cursor);
    endOfWindow.setHours(BUSINESS_END_HOUR, 0, 0, 0);
    const availableMs = endOfWindow.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return new Date(cursor.getTime() + remainingMs);
    }

    remainingMs -= availableMs;
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  }

  return cursor; // fallback — não deve acontecer com SLAs razoáveis
}

/**
 * Calcula o prazo de SLA em horas úteis (seg–sex, 08:00–18:00), pulando
 * feriados cadastrados em `ponto_feriados`. Busca os feriados do ano de
 * início e do ano seguinte de uma só vez.
 */
export async function computeSlaDeadline(
  svc: ReturnType<typeof createServiceClient>,
  start: Date,
  slaHours: number
): Promise<Date> {
  const startYear = start.getFullYear();
  const { data } = await svc
    .from("ponto_feriados")
    .select("date")
    .gte("date", `${startYear}-01-01`)
    .lte("date", `${startYear + 1}-12-31`);
  const holidays = new Set<string>((data ?? []).map((f: { date: string }) => f.date));
  return computeSlaDeadlineCore(start, slaHours, holidays);
}
