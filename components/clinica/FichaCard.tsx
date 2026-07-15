"use client";

import type { ReactNode } from "react";
import { CalendarDays, Clock, MapPin, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface FichaCardProps {
  /** Nome do profissional ou do item/procedimento */
  titulo: string;
  /** Badges ao lado do título (subespecialidade, idade mínima, "Hoje"...) */
  tituloBadges?: ReactNode;
  /** Chip de unidade */
  unidade?: { label: string; emoji?: string; cor?: string } | null;
  /** Especialidade (corpo clínico) ou categoria (procedimentos) */
  especialidade?: string | null;
  dias?: string | null;
  horarios?: string | null;
  local?: string | null;
  convenios?: string[] | null;
  /** Mostra o selo "Particular" */
  particular?: boolean;
  observacoes?: string | null;
  /** Bloco de valores/preço, alinhado à direita (cada tela monta o seu) */
  valor?: ReactNode;
  /** Botões de ação (editar/excluir) */
  acoes?: ReactNode;
  inativo?: boolean;
}

/**
 * Card padrão compartilhado por Corpo Clínico e Procedimentos/Exames.
 * Cabeçalho (título · unidade · especialidade) + linhas de dias, horários,
 * local, convênios e observações. Campos ausentes simplesmente não aparecem.
 */
export function FichaCard({
  titulo, tituloBadges, unidade, especialidade,
  dias, horarios, local, convenios, particular, observacoes,
  valor, acoes, inativo,
}: FichaCardProps) {
  return (
    <div className={`px-4 py-3.5 ${inativo ? "opacity-50" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Conteúdo principal */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Cabeçalho: título + badges */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-gray-900">{titulo}</span>
            {tituloBadges}
          </div>

          {/* Unidade · Especialidade */}
          {(unidade || especialidade) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {unidade && (
                <Badge variant="outline" className={`border ${unidade.cor ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                  {unidade.emoji ? `${unidade.emoji} ` : ""}{unidade.label}
                </Badge>
              )}
              {especialidade && <span className="text-muted-foreground">{especialidade}</span>}
            </div>
          )}

          {/* Dias / Horários / Local */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {dias && dias !== "—" && (
              <span className="flex items-center gap-1"><CalendarDays size={12} className="shrink-0" /> {dias}</span>
            )}
            {horarios && horarios !== "—" && (
              <span className="flex items-center gap-1"><Clock size={12} className="shrink-0" /> {horarios}</span>
            )}
            {local && (
              <span className="flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {local}</span>
            )}
          </div>

          {/* Convênios */}
          {(convenios?.length || particular) && (
            <div className="flex flex-wrap items-center gap-1">
              {convenios?.map(c => (
                <Badge key={c} className="border-0 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0">{c}</Badge>
              ))}
              {particular && (
                <Badge className="border-0 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0">Particular</Badge>
              )}
            </div>
          )}

          {/* Observações */}
          {observacoes && (
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <Info size={12} className="mt-0.5 shrink-0" /> {observacoes}
            </p>
          )}
        </div>

        {/* Valor + ações */}
        {(valor || acoes) && (
          <div className="flex items-center justify-between gap-2 shrink-0 sm:flex-col sm:items-end">
            {valor}
            {acoes && <div className="flex items-center gap-1">{acoes}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
