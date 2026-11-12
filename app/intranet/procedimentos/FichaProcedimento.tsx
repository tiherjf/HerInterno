"use client";

import type { ReactNode } from "react";
import { AlertCircle, Package, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Procedimento } from "@/lib/procedimentos/types";
import { medicosDe } from "@/lib/procedimentos/filtro";
import { economiaPacote, itensPreparo, parcela, temValor, textoConvenios } from "@/lib/procedimentos/valores";
import { TIPOS, UNIDADES_PROC } from "./FiltrosProc";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titulo}</h3>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function FichaProcedimento({ item: p, podeEditar, onEditar, onAlternarAtivo }: {
  item: Procedimento;
  podeEditar: boolean;
  onEditar: () => void;
  onAlternarAtivo: () => void;
}) {
  const tipo = TIPOS.find((t) => t.key === p.tipo)?.singular ?? p.tipo;
  const unidade = UNIDADES_PROC.find((u) => u.key === p.unidade)?.label ?? p.unidade;
  const valorParcela = parcela(p);
  const temPacote = p.pacote_sessoes != null && p.pacote_preco != null;
  const economia = economiaPacote(p);
  const preparo = itensPreparo(p);
  const convenios = textoConvenios(p);
  const medicos = medicosDe(p);
  const agenda = [p.dias, p.horarios].filter((v) => v?.trim()).join(" · ");

  return (
    <article className="space-y-4 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
              {[tipo, p.categoria?.trim()].filter(Boolean).join(" · ")}
            </span>
            {!p.ativo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Inativo</span>}
          </div>
          <h2 className="text-lg font-bold leading-tight text-slate-900">{p.nome}</h2>
          <p className="text-sm text-slate-500">
            {[unidade, p.duracao_min != null ? `${p.duracao_min} min` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {podeEditar && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={onEditar}><Pencil size={13} /> Editar</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onAlternarAtivo}
              title={p.ativo ? "Desativar" : "Ativar"}
              aria-label={p.ativo ? "Desativar" : "Ativar"}
              className={p.ativo ? "text-green-600 hover:text-green-800" : "text-slate-400 hover:text-slate-600"}
            >
              {p.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            </Button>
          </div>
        )}
      </div>

      <Bloco titulo="Valor">
        {!temValor(p) ? (
          <span className="text-slate-500">Valor não cadastrado</span>
        ) : (
          <div className="space-y-1.5">
            {p.preco != null && (
              <p>
                <span className="text-lg font-bold tabular-nums text-emerald-700">{BRL.format(p.preco)}</span>
                {p.unidade_medida?.trim() && <span className="text-slate-500"> /{p.unidade_medida.trim()}</span>}
              </p>
            )}
            {p.parcelas_max ? (
              <p className="text-slate-500">
                em até {p.parcelas_max}x{valorParcela != null ? ` de ${BRL.format(valorParcela)}` : ""}
              </p>
            ) : null}
            {temPacote && (
              <p className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                <Package size={12} className="shrink-0" />
                <span>
                  <strong>{p.pacote_sessoes} sessões:</strong> {BRL.format(p.pacote_preco ?? 0)}
                  {economia > 0 && <> (economiza {BRL.format(economia)})</>}
                </span>
              </p>
            )}
            {p.protocolo?.trim() && <p className="text-xs text-slate-500">{p.protocolo}</p>}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Convênios">
        {convenios.length === 0 ? (
          <span className="text-slate-500">Não informado</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {convenios.map((c) => (
              <span key={c} className="rounded-full border border-border px-2 py-0.5 text-xs text-slate-600">{c}</span>
            ))}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Preparo">
        {preparo.length === 0 ? (
          <span className="text-slate-500">Sem preparo especial</span>
        ) : (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {preparo.map((linha) => (
              <li key={linha} className="flex gap-1.5">
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                <span className="whitespace-pre-line">{linha}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      {(medicos.length > 0 || agenda) && (
        <Bloco titulo="Médicos">
          {medicos.length > 0 && <p>{medicos.join(" · ")}</p>}
          {agenda && <p className="text-xs text-slate-500">{agenda}</p>}
        </Bloco>
      )}

      {p.descricao?.trim() && (
        <Bloco titulo="Descrição">
          <p className="whitespace-pre-line">{p.descricao}</p>
        </Bloco>
      )}
    </article>
  );
}
