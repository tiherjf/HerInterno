export type TipoKey = "exame" | "procedimento";

/** Procedimento/exame como vem de getProcedimentos / GET /api/procedimentos. */
export interface Procedimento {
  id: string;
  nome: string;
  tipo: TipoKey;
  unidade: string;
  descricao: string | null;
  preparacao: string | null;
  ativo: boolean;
  order_num: number;
  categoria: string | null;
  preco: number | null;
  unidade_medida: string | null;
  protocolo: string | null;
  profissional: string | null;
  // Migração 044
  convenios: string[] | null;
  atende_particular: boolean | null;
  parcelas_max: number | null;
  pacote_sessoes: number | null;
  pacote_preco: number | null;
  jejum_horas: number | null;
  requer_agendamento: boolean | null;
  duracao_min: number | null;
  documentos_necessarios: string | null;
  suspende_medicacao: string | null;
  medicos: string[] | null;
  // Migração 046
  dias: string | null;
  horarios: string | null;
}
