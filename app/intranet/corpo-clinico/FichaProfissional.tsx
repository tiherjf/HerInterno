"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agendaDoDia, atendeNoDia } from "@/components/corpo-clinico/agenda";
import type { Profissional } from "@/lib/corpo-clinico/types";
import { conveniosQueCasam, iniciais, limparConvenios } from "@/lib/corpo-clinico/filtro";
import { UNIDADES_CC } from "./FiltrosCC";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const vazio = (v?: string | null) => !v || v.trim() === "" || v.trim() === "—";

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function FichaProfissional({ prof, termoConvenio, hoje, podeEditar, onEditar, onRemover }: {
  prof: Profissional;
  termoConvenio: string;
  hoje: number;
  podeEditar: boolean;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const unidade = UNIDADES_CC.find((u) => u.key === prof.unidade)?.label ?? prof.unidade;
  const entradasHoje = agendaDoDia(prof.agenda, hoje);
  const atendeHoje = atendeNoDia(prof.agenda, prof.dias, hoje);
  const atendimento = [prof.dias, prof.horarios].filter((v) => !vazio(v)).map((v) => v.trim()).join(" · ");

  const valores = [
    ["Consulta particular", prof.valor_particular],
    ["Pequenos convênios", prof.valor_convenio],
    ["Particular com desconto", prof.valor_desconto],
  ].filter((v): v is [string, number] => v[1] != null);

  const convenios = limparConvenios(prof.convenios);
  const casam = new Set(conveniosQueCasam(prof, termoConvenio));
  const ordenados = [...convenios.filter((c) => casam.has(c)), ...convenios.filter((c) => !casam.has(c))];
  const subtitulo = [prof.especialidade, prof.subespecialidade, unidade].filter(Boolean).join(" · ");

  return (
    <article className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
          {iniciais(prof.nome) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight text-slate-900">{prof.nome}</h2>
          <p className="text-sm text-slate-500">{subtitulo}</p>
        </div>
        {podeEditar && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={onEditar}><Pencil size={13} /> Editar</Button>
            <Button size="sm" variant="ghost" onClick={onRemover} className="text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Remover">
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>

      {atendeHoje && (
        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          Atende hoje{entradasHoje.length > 0 ? ` · ${entradasHoje.map((e) => `${e.inicio}–${e.fim}`).join(" / ")}` : ""}
        </span>
      )}

      <Bloco titulo="Atendimento">
        {prof.sem_agenda ? (
          <span className="text-amber-700">Ainda não liberou horário</span>
        ) : (
          <span>{atendimento || "Dias e horários não cadastrados"}</span>
        )}
        {(prof.local || prof.idade_minima != null) && (
          <p className="mt-0.5 text-xs text-slate-500">
            {[prof.local, prof.idade_minima != null ? `a partir de ${prof.idade_minima} anos` : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Valores">
        {valores.length === 0 ? (
          <span className="text-slate-500">Valores não cadastrados</span>
        ) : (
          <ul className="space-y-0.5">
            {valores.map(([rotulo, v]) => (
              <li key={rotulo} className="flex justify-between gap-3">
                <span>{rotulo}</span>
                <span className="font-semibold tabular-nums text-emerald-700">{BRL.format(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo={`Convênios (${convenios.length})`}>
        {convenios.length === 0 ? (
          <span className="text-amber-700">Nenhum convênio cadastrado</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ordenados.map((c) => (
              <span
                key={c}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  casam.has(c) ? "border-primary/40 bg-accent font-semibold text-primary" : "border-border text-slate-600"
                }`}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </Bloco>

      {!vazio(prof.observacoes) && (
        <Bloco titulo="Observações">
          <p className="whitespace-pre-line">{prof.observacoes}</p>
        </Bloco>
      )}
    </article>
  );
}
