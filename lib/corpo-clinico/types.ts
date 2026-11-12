import type { AgendaEntry } from "../../components/corpo-clinico/agenda";

/** Profissional do corpo clínico, como vem de getProfissionais / GET /api/corpo-clinico. */
export interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  grupo: string;
  unidade: string;
  dias: string;
  horarios: string;
  observacoes?: string | null;
  sem_agenda: boolean;
  agenda?: AgendaEntry[] | null;
  valor_particular?: number | null;
  valor_convenio?: number | null;
  valor_desconto?: number | null;
  convenios?: string[] | null;
  idade_minima?: number | null;
  local?: string | null;
  subespecialidade?: string | null;
}
