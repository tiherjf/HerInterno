"use client";

import { memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GrupoSetor } from "@/lib/chat-interno/conversas";
import type { Pessoa, Status } from "@/lib/chat-interno/tipos";
import { Avatar } from "./Avatar";

/** Diretório por setor, para começar conversa. Setores recolhíveis. */
export const ListaPessoas = memo(function ListaPessoas({
  grupos, recolhidos, onAlternarSetor, selecionado, statusDe, naoLidas, foraExpediente, offlineLabel, onAbrir,
}: {
  grupos: GrupoSetor[];
  recolhidos: Set<string>;
  onAlternarSetor: (setor: string) => void;
  selecionado: string | undefined;
  statusDe: (id: string) => Status | null;
  naoLidas: (id: string) => number;
  foraExpediente: boolean;
  offlineLabel: string;
  onAbrir: (p: Pessoa) => void;
}) {
  return (
    <div>
      {grupos.map((g) => {
        const fechado = recolhidos.has(g.setor);
        return (
          <section key={g.setor}>
            <button
              type="button"
              onClick={() => onAlternarSetor(g.setor)}
              aria-expanded={!fechado}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
            >
              {fechado ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="truncate">{g.setor}</span>
              <span className="ml-auto font-normal normal-case tracking-normal text-slate-400">
                {g.online}/{g.membros.length} online
              </span>
            </button>
            {!fechado && (
              <ul>
                {g.membros.map((p) => {
                  const status = statusDe(p.id);
                  const n = naoLidas(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onAbrir(p)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          selecionado === p.id ? "bg-accent" : "hover:bg-slate-50"
                        }`}
                      >
                        <Avatar nome={p.full_name} status={status} offlineLabel={offlineLabel} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{p.full_name}</p>
                          {!status && foraExpediente && <p className="truncate text-xs text-slate-400">Fora do expediente</p>}
                        </div>
                        {n > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                            {n > 99 ? "99+" : n}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
});
