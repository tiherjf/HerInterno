"use client";

import { memo } from "react";
import type { Conversa, Pessoa, Status } from "@/lib/chat-interno/tipos";
import { chaveDia, formatarHora } from "@/lib/chat-interno/formato";
import { Avatar } from "./Avatar";

const diaCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function quando(iso: string): string {
  return chaveDia(iso) === chaveDia(new Date()) ? formatarHora(iso) : diaCurto.format(new Date(iso));
}

/** Conversas recentes: urgente primeiro, depois a mais nova (lista já ordenada). */
export const ListaConversas = memo(function ListaConversas({
  conversas, pessoas, meuId, selecionado, statusDe, naoLidas, offlineLabel, onAbrir,
}: {
  conversas: Conversa[];
  pessoas: Map<string, Pessoa>;
  meuId: string;
  selecionado: string | undefined;
  statusDe: (id: string) => Status | null;
  naoLidas: (id: string) => number;
  offlineLabel: string;
  onAbrir: (p: Pessoa) => void;
}) {
  return (
    <ul>
      {conversas.map((c) => {
        const p = pessoas.get(c.with);
        if (!p) return null;
        const n = naoLidas(c.with);
        const ativo = selecionado === c.with;
        const m = c.last_message;
        const previa = m.content || (m.attachment_name ? `📎 ${m.attachment_name}` : "");
        return (
          <li key={c.with}>
            <button
              type="button"
              onClick={() => onAbrir(p)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                ativo ? "bg-accent" : c.urgente ? "bg-red-50 hover:bg-red-100/70" : "hover:bg-slate-50"
              }`}
            >
              <Avatar nome={p.full_name} status={statusDe(p.id)} offlineLabel={offlineLabel} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">
                  <span className="truncate">{p.full_name}</span>
                  {c.urgente && (
                    <span className="shrink-0 rounded bg-red-600 px-1 py-px text-[9px] font-bold tracking-wide text-white">URGENTE</span>
                  )}
                </p>
                <p className={`truncate text-xs ${n > 0 ? "font-medium text-slate-700" : "text-slate-500"}`}>
                  {m.sender_id === meuId ? "Você: " : ""}{previa}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-slate-400">{quando(m.created_at)}</span>
                {n > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
});
