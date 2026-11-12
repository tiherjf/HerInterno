/**
 * Regras puras do formulário de profissional. Reproduzem exatamente o que a
 * tela antiga enviava à API (mesmas chaves e valores), para a reescrita não
 * mudar nada no que é gravado.
 */
import type { AgendaEntry } from "../../components/corpo-clinico/agenda";
import type { Profissional } from "./types";

export interface FormCC {
  nome: string;
  especialidade: string;
  grupo: string; // "__novo__" = criar grupo com grupo_novo
  grupo_novo: string;
  unidade: string;
  dias: string;
  horarios: string;
  observacoes: string;
  sem_agenda: boolean;
  agenda: AgendaEntry[];
  valor_particular: number | null;
  valor_convenio: number | null;
  valor_desconto: number | null;
  convenios: string[];
  idade_minima: number | null;
  local: string;
  subespecialidade: string;
}

export const GRUPO_NOVO = "__novo__";
export const UNIDADE_PADRAO = "Clínica da Criança";

export const FORM_CC_VAZIO: FormCC = {
  nome: "",
  especialidade: "",
  grupo: "",
  grupo_novo: "",
  unidade: UNIDADE_PADRAO,
  dias: "",
  horarios: "",
  observacoes: "",
  sem_agenda: false,
  agenda: [],
  valor_particular: null,
  valor_convenio: null,
  valor_desconto: null,
  convenios: [],
  idade_minima: null,
  local: "",
  subespecialidade: "",
};

const temAgendaEstruturada = (p: Profissional | undefined) => Array.isArray(p?.agenda) && (p?.agenda?.length ?? 0) > 0;

/** Formulário preenchido com o profissional. O editor trabalha com uma faixa por dia (a primeira). */
export function formDeProfissional(p: Profissional): FormCC {
  const porDia = new Map<number, AgendaEntry>();
  for (const e of Array.isArray(p.agenda) ? p.agenda : []) {
    if (!porDia.has(e.dia)) porDia.set(e.dia, e);
  }
  return {
    nome: p.nome,
    especialidade: p.especialidade,
    grupo: p.grupo,
    grupo_novo: "",
    unidade: p.unidade ?? UNIDADE_PADRAO,
    dias: p.dias === "—" ? "" : p.dias,
    horarios: p.horarios === "—" ? "" : p.horarios,
    observacoes: p.observacoes ?? "",
    sem_agenda: p.sem_agenda,
    agenda: Array.from(porDia.values()).sort((a, b) => a.dia - b.dia),
    valor_particular: p.valor_particular ?? null,
    valor_convenio: p.valor_convenio ?? null,
    valor_desconto: p.valor_desconto ?? null,
    convenios: p.convenios ?? [],
    idade_minima: p.idade_minima ?? null,
    local: p.local ?? "",
    subespecialidade: p.subespecialidade ?? "",
  };
}

/** Nome do grupo que será gravado. */
export function grupoFinal(f: FormCC): string {
  return f.grupo === GRUPO_NOVO ? f.grupo_novo.trim() : f.grupo;
}

/** Mensagem de erro ou null quando pode salvar. */
export function validarFormCC(f: FormCC): string | null {
  if (!f.nome.trim() || !f.especialidade.trim() || !grupoFinal(f)) {
    return "Nome, especialidade e grupo são obrigatórios.";
  }
  if (!f.sem_agenda && f.agenda.length > 0 && f.agenda.some((e) => !e.inicio || !e.fim || e.inicio >= e.fim)) {
    return "Agenda: o horário de início deve ser antes do fim em todos os dias.";
  }
  return null;
}

/** Corpo do POST/PATCH /api/corpo-clinico. */
export function payloadProfissional(f: FormCC, original: Profissional | undefined): Record<string, unknown> {
  const temAgenda = !f.sem_agenda && f.agenda.length > 0;
  const body: Record<string, unknown> = {
    nome: f.nome.trim(),
    especialidade: f.especialidade.trim(),
    grupo: grupoFinal(f),
    unidade: f.unidade || UNIDADE_PADRAO,
    observacoes: f.observacoes.trim() || null,
    sem_agenda: f.sem_agenda,
    valor_particular: f.valor_particular,
    valor_convenio: f.valor_convenio,
    valor_desconto: f.valor_desconto,
    convenios: f.convenios.map((c) => c.trim()).filter(Boolean),
    idade_minima: f.idade_minima,
    local: f.local.trim() || null,
    subespecialidade: f.subespecialidade.trim() || null,
  };
  if (temAgenda) {
    // O servidor gera dias/horarios legíveis a partir da agenda
    body.agenda = f.agenda;
  } else {
    body.dias = f.sem_agenda ? "—" : f.dias.trim() || "—";
    body.horarios = f.sem_agenda ? "—" : f.horarios.trim() || "—";
    // Só limpa a coluna agenda se o registro tinha agenda estruturada
    if (temAgendaEstruturada(original)) body.agenda = null;
  }
  return body;
}

/** Cadastro antigo: sem agenda estruturada, mas com texto livre de dias/horários. */
export function legadoSemEstrutura(original: Profissional | undefined, f: FormCC): boolean {
  return !!original && !temAgendaEstruturada(original) && Boolean(f.dias.trim() || f.horarios.trim());
}
