"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { CampoBusca } from "@/components/ui-her/CampoBusca";
import type { Conversa, Pessoa, Status } from "@/lib/chat-interno/tipos";
import { agruparPorSetor, filtrarConversas, filtrarPessoas, ordenarConversas } from "@/lib/chat-interno/conversas";
import { ListaConversas } from "./ListaConversas";
import { ListaPessoas } from "./ListaPessoas";

type Aba = "conversas" | "pessoas";
const CHAVE_ABA = "chat-aba-v1";
const CHAVE_RECOLHIDOS = "chat-setores-recolhidos-v1";

function ler(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* armazenamento indisponível */ }
}

/** Abas Conversas · Pessoas com busca. A busca mora aqui para não redesenhar a conversa aberta. */
export function ColunaEsquerda({
  carregando, conversas, diretorio, meuId, selecionado, statusDe, online, naoLidas, totalNaoLidas,
  foraExpediente, offlineLabel, onAbrir,
}: {
  carregando: boolean;
  conversas: Conversa[];
  diretorio: Pessoa[];
  meuId: string;
  selecionado: string | undefined;
  statusDe: (id: string) => Status | null;
  online: (id: string) => boolean;
  naoLidas: (id: string) => number;
  totalNaoLidas: number;
  foraExpediente: boolean;
  offlineLabel: string;
  onAbrir: (p: Pessoa) => void;
}) {
  const [aba, setAba] = useState<Aba>("conversas");
  const [busca, setBusca] = useState("");
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  // Preferências lembradas no navegador
  useEffect(() => {
    if (ler(CHAVE_ABA) === "pessoas") setAba("pessoas");
    try {
      const salvos = JSON.parse(ler(CHAVE_RECOLHIDOS) ?? "[]");
      if (Array.isArray(salvos)) setRecolhidos(new Set(salvos.filter((s): s is string => typeof s === "string")));
    } catch { /* valor inválido — ignora */ }
  }, []);

  function trocarAba(a: Aba) {
    setAba(a);
    setBusca("");
    gravar(CHAVE_ABA, a);
  }

  const alternarSetor = useCallback((setor: string) => {
    setRecolhidos((prev) => {
      const prox = new Set(prev);
      if (prox.has(setor)) prox.delete(setor); else prox.add(setor);
      gravar(CHAVE_RECOLHIDOS, JSON.stringify(Array.from(prox)));
      return prox;
    });
  }, []);

  const pessoasPorId = useMemo(() => new Map(diretorio.map((p) => [p.id, p])), [diretorio]);
  const listaConversas = useMemo(
    () => ordenarConversas(filtrarConversas(conversas, pessoasPorId, aba === "conversas" ? busca : "")),
    [conversas, pessoasPorId, busca, aba],
  );
  const grupos = useMemo(
    () => agruparPorSetor(filtrarPessoas(diretorio, aba === "pessoas" ? busca : "", meuId), online),
    [diretorio, busca, aba, meuId, online],
  );
  // Buscando em Pessoas, mostra os setores abertos para não esconder o resultado
  const recolhidosVisiveis = useMemo(() => (busca.trim() ? new Set<string>() : recolhidos), [busca, recolhidos]);

  const abaClasse = (a: Aba) =>
    `flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold transition-colors ${
      aba === a ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <>
      <div role="tablist" aria-label="Lista do chat" className="flex border-b border-border">
        <button type="button" role="tab" aria-selected={aba === "conversas"} className={abaClasse("conversas")} onClick={() => trocarAba("conversas")}>
          Conversas
          {totalNaoLidas > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
              {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
            </span>
          )}
        </button>
        <button type="button" role="tab" aria-selected={aba === "pessoas"} className={abaClasse("pessoas")} onClick={() => trocarAba("pessoas")}>
          Pessoas
        </button>
      </div>

      <div className="p-3">
        <CampoBusca
          value={busca}
          onChange={setBusca}
          placeholder={aba === "pessoas" ? "Buscar pessoa, setor ou ramal..." : "Buscar conversa..."}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : aba === "conversas" ? (
          listaConversas.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              {busca.trim() ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Abra a aba Pessoas para começar."}
            </p>
          ) : (
            <ListaConversas
              conversas={listaConversas}
              pessoas={pessoasPorId}
              meuId={meuId}
              selecionado={selecionado}
              statusDe={statusDe}
              naoLidas={naoLidas}
              offlineLabel={offlineLabel}
              onAbrir={onAbrir}
            />
          )
        ) : grupos.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Nenhum colaborador encontrado.</p>
        ) : (
          <ListaPessoas
            grupos={grupos}
            recolhidos={recolhidosVisiveis}
            onAlternarSetor={alternarSetor}
            selecionado={selecionado}
            statusDe={statusDe}
            naoLidas={naoLidas}
            foraExpediente={foraExpediente}
            offlineLabel={offlineLabel}
            onAbrir={onAbrir}
          />
        )}
      </div>
    </>
  );
}
