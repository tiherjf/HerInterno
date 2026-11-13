"use client";

import { useState } from "react";
import { Check, ChevronLeft, Copy, Phone } from "lucide-react";
import type { Pessoa, Status } from "@/lib/chat-interno/tipos";
import { Avatar, STATUS_META } from "./Avatar";

/** Topo da conversa: voltar (celular), pessoa, setor · status ou "digitando…", ramal em destaque. */
export function CabecalhoConversa({ pessoa, status, offlineLabel, digitando, onVoltar }: {
  pessoa: Pessoa;
  status: Status | null;
  offlineLabel: string;
  digitando: boolean;
  onVoltar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const ramal = pessoa.phone_ext?.trim();

  async function copiar() {
    if (!ramal) return;
    try {
      await navigator.clipboard.writeText(ramal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* área de transferência indisponível */ }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
      <button
        type="button"
        onClick={onVoltar}
        className="rounded-md p-1 text-slate-500 hover:bg-slate-100 md:hidden"
        aria-label="Voltar"
      >
        <ChevronLeft size={20} />
      </button>
      <Avatar nome={pessoa.full_name} status={status} offlineLabel={offlineLabel} tamanho="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{pessoa.full_name}</p>
        <p className="truncate text-xs text-slate-500">
          {digitando ? (
            <span className="font-medium text-primary">digitando...</span>
          ) : (
            <>{pessoa.sector?.trim() || "Sem setor"} · {status ? STATUS_META[status].label : offlineLabel}</>
          )}
        </p>
      </div>
      {ramal && (
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">Ramal</span>
          <span className="text-lg font-bold tabular-nums text-primary">{ramal}</span>
          <a
            href={`tel:${ramal}`}
            className="rounded-md border border-border bg-white p-1.5 text-primary hover:bg-accent"
            title="Ligar para o ramal"
            aria-label={`Ligar para o ramal ${ramal}`}
          >
            <Phone size={14} />
          </a>
          <button
            type="button"
            onClick={copiar}
            className={`rounded-md border p-1.5 ${copiado ? "border-green-200 bg-green-50 text-green-600" : "border-border bg-white text-primary hover:bg-accent"}`}
            title="Copiar ramal"
            aria-label="Copiar ramal"
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
