"use client";

import type { Procedimento } from "@/lib/procedimentos/types";
import { medicosDe } from "@/lib/procedimentos/filtro";
import { TIPOS } from "./FiltrosProc";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Lista de procedimentos agrupada por categoria (sem categoria = "Geral"). */
export function ListaProc({ grupos, selecionado, selecionar }: {
  grupos: { categoria: string | null; itens: Procedimento[] }[];
  selecionado: string | null;
  selecionar: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {grupos.map((g) => (
        <section key={g.categoria ?? "__geral__"} className="space-y-1.5">
          <h2 className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.categoria ?? "Geral"}</h2>
          {g.itens.map((p) => {
            const ativo = selecionado === p.id;
            const tipo = TIPOS.find((t) => t.key === p.tipo)?.singular ?? p.tipo;
            const medicos = medicosDe(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionar(p.id)}
                aria-current={ativo || undefined}
                className={`flex w-full items-start gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
                  ativo ? "border-primary/40 bg-accent/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-slate-50"
                } ${p.ativo ? "" : "opacity-60"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{p.nome}</span>
                    {!p.ativo && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inativo</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[tipo, medicos.join(", ")].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {p.preco != null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">{BRL.format(p.preco)}</span>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
