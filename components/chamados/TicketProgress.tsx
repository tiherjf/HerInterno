"use client";

import { Check, Clock, Pause, XCircle } from "lucide-react";

// Etapas do fluxo do chamado, na ordem.
const STEPS = [
  { key: "open", label: "Aberto" },
  { key: "in_progress", label: "Em Atendimento" },
  { key: "resolved", label: "Resolvido" },
  { key: "closed", label: "Encerrado" },
] as const;

// Mapeia cada status para o índice da etapa atual.
const STATUS_STEP: Record<string, number> = {
  open: 0,
  in_progress: 1,
  waiting_user: 1,
  waiting_third_party: 1,
  resolved: 2,
  closed: 3,
};

const PAUSA_LABEL: Record<string, string> = {
  waiting_user: "Aguardando o solicitante responder",
  waiting_third_party: "Aguardando terceiros",
};

/**
 * Barra de progresso do chamado (Aberto → Em Atendimento → Resolvido → Encerrado).
 * Usada tanto pelo solicitante quanto pelo agente.
 */
export function TicketProgress({ status }: { status: string }) {
  // Cancelado: estado terminal fora do fluxo normal
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <XCircle size={16} className="shrink-0" />
        <span className="font-medium">Chamado cancelado</span>
      </div>
    );
  }

  const current = STATUS_STEP[status] ?? 0;
  const paused = status === "waiting_user" || status === "waiting_third_party";
  const lastIndex = STEPS.length - 1;
  // Largura da linha preenchida: até a etapa atual
  const fillPct = current === 0 ? 0 : (current / lastIndex) * 100;

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* Trilho de fundo */}
        <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-gray-200" />
        {/* Trilho preenchido */}
        <div
          className={`absolute left-0 top-3 h-1 rounded-full transition-all ${paused ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${fillPct}%` }}
        />
        {/* Marcos */}
        <div className="relative flex justify-between">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1" style={{ width: `${100 / STEPS.length}%` }}>
                <div
                  className={[
                    "flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-[10px] font-bold transition-colors",
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "",
                    active && paused ? "border-amber-400 text-amber-600" : "",
                    active && !paused ? "border-emerald-500 text-emerald-600" : "",
                    !done && !active ? "border-gray-300 text-gray-400" : "",
                  ].join(" ")}
                >
                  {done ? <Check size={13} /> : active && paused ? <Pause size={12} /> : i + 1}
                </div>
                <span
                  className={`text-center text-[10px] leading-tight ${
                    active ? (paused ? "font-semibold text-amber-700" : "font-semibold text-emerald-700") : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {paused && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-amber-700">
          <Clock size={12} />
          {PAUSA_LABEL[status]} — SLA pausado
        </div>
      )}
    </div>
  );
}
