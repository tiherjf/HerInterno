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

// Mapa de prefixos (sem acento, minúsculo) → dia da semana (0=domingo … 6=sábado).
const PREFIXO_DIA: [string, number][] = [
  ["dom", 0], ["seg", 1], ["ter", 2], ["qua", 3], ["qui", 4], ["sex", 5], ["sab", 6],
];

function normalizarTexto(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Converte um token ("seg", "segunda", "(quarta)"…) no dia da semana, ou null. */
function tokenParaDia(token: string): number | null {
  const t = normalizarTexto(token).replace(/[^a-z]/g, "");
  if (!t) return null;
  for (const [prefixo, dia] of PREFIXO_DIA) {
    if (t.startsWith(prefixo)) return dia;
  }
  return null;
}

/**
 * Interpreta o texto livre de dias ("Seg/Ter/Qui", "Seg a Sex", "Quarta",
 * "Terça/Quarta"…) e devolve o conjunto de dias da semana (0–6).
 * Entende abreviações, nomes completos, separadores /,; e "e", e intervalos "X a Y".
 */
export function diasDoTexto(dias: string | null | undefined): Set<number> {
  const set = new Set<number>();
  if (!dias || typeof dias !== "string") return set;
  let t = normalizarTexto(dias);
  // Intervalos "seg a sex" → expande circularmente do início ao fim
  t = t.replace(/([a-z]{3,})\s+a\s+([a-z]{3,})/g, (_m, a: string, b: string) => {
    const di = tokenParaDia(a);
    const df = tokenParaDia(b);
    if (di !== null && df !== null) {
      let d = di;
      for (let i = 0; i < 7; i++) {
        set.add(d);
        if (d === df) break;
        d = (d + 1) % 7;
      }
    }
    return " ";
  });
  // Tokens restantes separados por / , ; ou " e "
  for (const tok of t.split(/[/,;]|\se\s/)) {
    const d = tokenParaDia(tok);
    if (d !== null) set.add(d);
  }
  return set;
}

/**
 * Se o profissional atende no dia informado, considerando a agenda estruturada
 * (quando existe) OU o texto livre de dias.
 */
export function atendeNoDia(
  agenda: AgendaEntry[] | null | undefined,
  dias: string | null | undefined,
  dia: number,
): boolean {
  if (agendaDoDia(agenda, dia).length > 0) return true;
  return diasDoTexto(dias).has(dia);
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
