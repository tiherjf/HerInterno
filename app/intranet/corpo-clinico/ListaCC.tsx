"use client";

import { atendeNoDia } from "@/components/corpo-clinico/agenda";
import type { Profissional } from "@/lib/corpo-clinico/types";
import { iniciais } from "@/lib/corpo-clinico/filtro";

function Linha({ p, hoje, selecionado, aConfirmar, onClick }: {
  p: Profissional;
  hoje: number;
  selecionado: boolean;
  aConfirmar: boolean;
  onClick: () => void;
}) {
  const atendeHoje = atendeNoDia(p.agenda, p.dias, hoje);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selecionado || undefined}
      className={`flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
        selecionado ? "border-primary/40 bg-accent/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30 hover:bg-slate-50"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
        {iniciais(p.nome) || "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{p.nome}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          <span className="truncate">{p.especialidade || p.grupo}</span>
          {atendeHoje && <span className="font-semibold text-green-700">· hoje</span>}
        </span>
      </span>
      {aConfirmar ? (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">convênio a confirmar</span>
      ) : p.sem_agenda ? (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">sem agenda</span>
      ) : null}
    </button>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h2>
      {children}
    </section>
  );
}

/** Lista do corpo clínico: seções por especialidade e, com filtro de convênio, a seção "não informado" no fim. */
export function ListaCC({ grupos, naoInformado, hoje, selecionado, selecionar }: {
  grupos: { grupo: string; itens: Profissional[] }[];
  naoInformado: Profissional[];
  hoje: number;
  selecionado: string | null;
  selecionar: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {grupos.map((g) => (
        <Secao key={g.grupo} titulo={g.grupo}>
          {g.itens.map((p) => (
            <Linha key={p.id} p={p} hoje={hoje} aConfirmar={false} selecionado={selecionado === p.id} onClick={() => selecionar(p.id)} />
          ))}
        </Secao>
      ))}
      {naoInformado.length > 0 && (
        <Secao titulo="Convênio não informado — confirmar">
          {naoInformado.map((p) => (
            <Linha key={p.id} p={p} hoje={hoje} aConfirmar selecionado={selecionado === p.id} onClick={() => selecionar(p.id)} />
          ))}
        </Secao>
      )}
    </div>
  );
}
