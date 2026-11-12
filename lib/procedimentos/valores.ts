/** Valores, preparo e convênios de um procedimento, prontos para exibir. */
import type { Procedimento } from "./types";

/** Valor de cada parcela, ou null sem preço ou sem parcelamento. */
export function parcela(p: Procedimento): number | null {
  if (p.preco == null || !p.parcelas_max) return null;
  return p.preco / p.parcelas_max;
}

/** Quanto o pacote economiza frente às sessões avulsas (0 sem dados; nunca negativo). */
export function economiaPacote(p: Procedimento): number {
  if (p.preco == null || p.pacote_sessoes == null || p.pacote_preco == null) return 0;
  return Math.max(0, p.preco * p.pacote_sessoes - p.pacote_preco);
}

/** Linhas do quadro de preparo, na ordem de exibição. */
export function itensPreparo(p: Procedimento): string[] {
  const itens: string[] = [];
  if (p.jejum_horas != null) itens.push(p.jejum_horas === 0 ? "Sem jejum" : `Jejum ${p.jejum_horas}h`);
  if (p.suspende_medicacao?.trim()) itens.push(`Suspender medicação: ${p.suspende_medicacao.trim()}`);
  if (p.documentos_necessarios?.trim()) itens.push(`Documentos: ${p.documentos_necessarios.trim()}`);
  if (p.requer_agendamento) itens.push("Requer agendamento");
  if (p.preparacao?.trim()) itens.push(p.preparacao.trim());
  return itens;
}

/** Há algo a mostrar no bloco Valor (preço, pacote, parcelamento ou protocolo). */
export function temValor(p: Procedimento): boolean {
  return p.preco != null || (p.pacote_sessoes != null && p.pacote_preco != null) || !!p.parcelas_max || !!p.protocolo?.trim();
}

/** Convênios aceitos + "Particular"; "Somente particular" quando não há convênios. */
export function textoConvenios(p: Procedimento): string[] {
  const convenios = (p.convenios ?? []).filter((c): c is string => typeof c === "string" && c.trim() !== "");
  if (convenios.length === 0) return p.atende_particular ? ["Somente particular"] : [];
  return p.atende_particular ? [...convenios, "Particular"] : convenios;
}
