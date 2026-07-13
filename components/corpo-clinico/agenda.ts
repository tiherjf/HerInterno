// Helpers puros da agenda estruturada do corpo clínico.
// Usado tanto pelas rotas de API (validação/formatação) quanto pela UI.
// Contrato: agenda é null ou um array de { dia, inicio, fim },
// onde dia é 0=domingo ... 6=sábado e inicio/fim são "HH:MM".

export interface AgendaEntry {
  dia: number; // 0=domingo ... 6=sábado
  inicio: string; // "HH:MM"
  fim: string; // "HH:MM"
}

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const HORA_RE = /^\d{2}:\d{2}$/;

export type AgendaValidacao =
  | { ok: true; agenda: AgendaEntry[] | null }
  | { ok: false; error: string };

/**
 * Valida o payload de agenda vindo do cliente.
 * null é válido (sem agenda estruturada); array vazio é normalizado para null.
 */
export function validarAgenda(value: unknown): AgendaValidacao {
  if (value === null || value === undefined) return { ok: true, agenda: null };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Agenda deve ser nula ou uma lista de horários." };
  }
  const agenda: AgendaEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, error: "Cada item da agenda deve ser um objeto { dia, inicio, fim }." };
    }
    const { dia, inicio, fim } = item as Record<string, unknown>;
    if (typeof dia !== "number" || !Number.isInteger(dia) || dia < 0 || dia > 6) {
      return { ok: false, error: "Agenda: dia deve ser um inteiro entre 0 (domingo) e 6 (sábado)." };
    }
    if (typeof inicio !== "string" || !HORA_RE.test(inicio)) {
      return { ok: false, error: "Agenda: horário de início deve estar no formato HH:MM." };
    }
    if (typeof fim !== "string" || !HORA_RE.test(fim)) {
      return { ok: false, error: "Agenda: horário de fim deve estar no formato HH:MM." };
    }
    if (inicio >= fim) {
      return { ok: false, error: `Agenda: início (${inicio}) deve ser antes do fim (${fim}).` };
    }
    agenda.push({ dia, inicio, fim });
  }
  if (agenda.length === 0) return { ok: true, agenda: null };
  agenda.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  return { ok: true, agenda };
}

/** Ex.: [seg, qua, sex] -> "Seg, Qua e Sex" */
export function formatarDias(agenda: AgendaEntry[]): string {
  const dias = Array.from(new Set(agenda.map(e => e.dia))).sort((a, b) => a - b);
  const nomes = dias.map(d => DIAS_CURTOS[d]);
  if (nomes.length === 0) return "—";
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * Se todos os dias têm as mesmas faixas: "08:00–12:00 / 14:00–18:00".
 * Caso contrário, por dia: "Seg 08:00–12:00 · Qua 14:00–18:00".
 */
export function formatarHorarios(agenda: AgendaEntry[]): string {
  if (agenda.length === 0) return "—";
  const ordenada = [...agenda].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  const porDia = new Map<number, string[]>();
  for (const e of ordenada) {
    const faixas = porDia.get(e.dia) ?? [];
    faixas.push(`${e.inicio}–${e.fim}`);
    porDia.set(e.dia, faixas);
  }
  const assinaturas = Array.from(new Set(Array.from(porDia.values()).map(f => f.join(" / "))));
  if (assinaturas.length === 1) return assinaturas[0];
  return Array.from(porDia.entries())
    .map(([dia, faixas]) => `${DIAS_CURTOS[dia]} ${faixas.join(" / ")}`)
    .join(" · ");
}

/** Entradas da agenda para o dia da semana informado (0–6), ordenadas por início. */
export function agendaDoDia(agenda: AgendaEntry[] | null | undefined, dia: number): AgendaEntry[] {
  if (!Array.isArray(agenda)) return [];
  return agenda
    .filter(e => e && typeof e.dia === "number" && e.dia === dia)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/**
 * Detecta erro de coluna inexistente para "agenda" (migração 039 não aplicada).
 * Postgres: 42703 (undefined_column); PostgREST: PGRST204 (coluna fora do schema cache).
 */
export function erroColunaAgenda(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (e.code === "42703" || e.code === "PGRST204") && msg.includes("agenda");
}

// ---------------------------------------------------------------------------
// Campos da migração 045 (valores, convênios, idade mínima e localização).
// Degradação graciosa igual à da agenda: se a migração não foi aplicada, a
// rota tenta salvar novamente sem estas colunas e devolve um aviso.
// ---------------------------------------------------------------------------

export const COLUNAS_045 = [
  "valor_particular",
  "valor_convenio",
  "valor_desconto",
  "convenios",
  "idade_minima",
  "local",
  "subespecialidade",
] as const;

export const AVISO_045 = "Execute a migração 045 no Supabase para salvar valores/convênios.";

export type Campos045Validacao =
  | { ok: true; campos: Record<string, unknown> }
  | { ok: false; error: string };

const LABEL_VALOR: Record<string, string> = {
  valor_particular: "Valor particular",
  valor_convenio: "Valor convênio",
  valor_desconto: "Valor desconto",
};

/** Número ≥ 0 ou null. String vazia → null; string numérica é aceita (vírgula → ponto). */
function coerceValor(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

/** Convênios: array ou string separada por vírgulas → array de textos não-vazios (ou null). */
function coerceConvenios(value: unknown): { ok: true; value: string[] | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  let bruto: unknown[];
  if (typeof value === "string") bruto = value.split(",");
  else if (Array.isArray(value)) bruto = value;
  else return { ok: false };
  const limpos = bruto.map(x => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return { ok: true, value: limpos.length ? limpos : null };
}

/**
 * Valida/normaliza somente os campos da 045 presentes no corpo da requisição.
 * Retorna apenas as chaves enviadas, para servir tanto ao POST quanto ao PATCH.
 */
export function coerceCampos045(body: Record<string, unknown>): Campos045Validacao {
  const campos: Record<string, unknown> = {};

  for (const key of ["valor_particular", "valor_convenio", "valor_desconto"] as const) {
    if (key in body) {
      const r = coerceValor(body[key]);
      if (!r.ok) return { ok: false, error: `${LABEL_VALOR[key]} deve ser um número maior ou igual a zero.` };
      campos[key] = r.value;
    }
  }

  if ("idade_minima" in body) {
    const v = body.idade_minima;
    if (v === null || v === undefined || v === "") {
      campos.idade_minima = null;
    } else {
      const n = typeof v === "string" ? Number(v) : v;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        return { ok: false, error: "Idade mínima deve ser um número inteiro maior ou igual a zero." };
      }
      campos.idade_minima = n;
    }
  }

  if ("convenios" in body) {
    const r = coerceConvenios(body.convenios);
    if (!r.ok) return { ok: false, error: "Convênios deve ser uma lista ou texto separado por vírgulas." };
    campos.convenios = r.value;
  }

  for (const key of ["local", "subespecialidade"] as const) {
    if (key in body) {
      const v = body[key];
      const s = typeof v === "string" ? v.trim() : "";
      campos[key] = s || null;
    }
  }

  return { ok: true, campos };
}

/** Erro de coluna inexistente para algum campo da 045 (migração não aplicada). */
export function erroColuna045(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code !== "42703" && e.code !== "PGRST204") return false;
  const msg = (e.message ?? "").toLowerCase();
  return COLUNAS_045.some(c => msg.includes(c));
}
