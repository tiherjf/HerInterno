/**
 * Regras puras do formulário de procedimento. Reproduzem exatamente o corpo
 * que a tela antiga enviava (convênios e médicos como texto separado por
 * vírgula; a API divide).
 */
import type { Procedimento, TipoKey } from "./types";

export interface FormProc {
  nome: string;
  tipo: TipoKey;
  unidade: string;
  descricao: string;
  preparacao: string;
  categoria: string;
  preco: number | null;
  unidade_medida: string;
  protocolo: string;
  profissional: string;
  convenios: string;
  atende_particular: boolean;
  parcelas_max: number | null;
  pacote_sessoes: number | null;
  pacote_preco: number | null;
  jejum_horas: number | null;
  requer_agendamento: boolean;
  duracao_min: number | null;
  documentos_necessarios: string;
  suspende_medicacao: string;
  medicos: string;
  dias: string;
  horarios: string;
}

export const FORM_PROC_VAZIO: FormProc = {
  nome: "",
  tipo: "exame",
  unidade: "Hospital",
  descricao: "",
  preparacao: "",
  categoria: "",
  preco: null,
  unidade_medida: "",
  protocolo: "",
  profissional: "",
  convenios: "",
  atende_particular: true,
  parcelas_max: null,
  pacote_sessoes: null,
  pacote_preco: null,
  jejum_horas: null,
  requer_agendamento: false,
  duracao_min: null,
  documentos_necessarios: "",
  suspende_medicacao: "",
  medicos: "",
  dias: "",
  horarios: "",
};

export function formDeProcedimento(p: Procedimento): FormProc {
  return {
    nome: p.nome,
    tipo: p.tipo,
    unidade: p.unidade,
    descricao: p.descricao ?? "",
    preparacao: p.preparacao ?? "",
    categoria: p.categoria ?? "",
    preco: p.preco ?? null,
    unidade_medida: p.unidade_medida ?? "",
    protocolo: p.protocolo ?? "",
    profissional: p.profissional ?? "",
    convenios: (p.convenios ?? []).join(", "),
    atende_particular: p.atende_particular ?? true,
    parcelas_max: p.parcelas_max ?? null,
    pacote_sessoes: p.pacote_sessoes ?? null,
    pacote_preco: p.pacote_preco ?? null,
    jejum_horas: p.jejum_horas ?? null,
    requer_agendamento: p.requer_agendamento ?? false,
    duracao_min: p.duracao_min ?? null,
    documentos_necessarios: p.documentos_necessarios ?? "",
    suspende_medicacao: p.suspende_medicacao ?? "",
    medicos: (p.medicos ?? []).join(", "),
    dias: p.dias ?? "",
    horarios: p.horarios ?? "",
  };
}

export function validarFormProc(f: FormProc): string | null {
  if (!f.nome.trim() || !f.unidade) return "Nome e unidade são obrigatórios.";
  return null;
}

/** Corpo do POST/PATCH /api/procedimentos. */
export function payloadProcedimento(f: FormProc): Record<string, unknown> {
  return {
    nome: f.nome.trim(),
    tipo: f.tipo,
    unidade: f.unidade,
    descricao: f.descricao.trim() || null,
    preparacao: f.preparacao.trim() || null,
    categoria: f.categoria.trim() || null,
    preco: f.preco,
    unidade_medida: f.unidade_medida.trim() || null,
    protocolo: f.protocolo.trim() || null,
    profissional: f.profissional.trim() || null,
    convenios: f.convenios,
    atende_particular: f.atende_particular,
    parcelas_max: f.parcelas_max,
    pacote_sessoes: f.pacote_sessoes,
    pacote_preco: f.pacote_preco,
    jejum_horas: f.jejum_horas,
    requer_agendamento: f.requer_agendamento,
    duracao_min: f.duracao_min,
    documentos_necessarios: f.documentos_necessarios.trim() || null,
    suspende_medicacao: f.suspende_medicacao.trim() || null,
    medicos: f.medicos,
    dias: f.dias.trim() || null,
    horarios: f.horarios.trim() || null,
  };
}
