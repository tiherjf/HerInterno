"use client";

import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/eventos/status";

/**
 * Ação/estado de um evento nas listas: botão para se inscrever ou entrar na
 * fila; selo para os demais estados (cancelar fica na tela do evento).
 */
export function EventAction({
  status,
  acting,
  onAct,
  className,
}: {
  status: EventStatus;
  acting?: boolean;
  onAct: () => void;
  className?: string;
}) {
  if (status === "open" || status === "full") {
    return (
      <button
        type="button"
        disabled={acting}
        onClick={(e) => {
          // a linha inteira é um link: o botão não navega
          e.preventDefault();
          e.stopPropagation();
          onAct();
        }}
        className={cn(
          "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors disabled:opacity-60",
          status === "open"
            ? "bg-primary text-white hover:bg-primary/90"
            : "border border-primary/30 bg-white text-primary hover:bg-accent",
          className
        )}
      >
        {acting && <Loader2 size={14} className="animate-spin" />}
        {status === "open" ? "Inscrever-se" : "Entrar na fila"}
      </button>
    );
  }

  const chip: Record<Exclude<EventStatus, "open" | "full">, { label: string; cls: string; icon?: React.ReactNode }> = {
    registered: { label: "Inscrito", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={13} /> },
    waitlisted: { label: "Na fila", cls: "bg-amber-100 text-amber-700", icon: <Clock3 size={13} /> },
    closed: { label: "Inscrições encerradas", cls: "bg-slate-100 text-slate-500" },
    ended: { label: "Encerrado", cls: "bg-slate-100 text-slate-500" },
    participated: { label: "Você participou", cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={13} /> },
  };
  const c = chip[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        c.cls,
        className
      )}
    >
      {c.icon} {c.label}
    </span>
  );
}
