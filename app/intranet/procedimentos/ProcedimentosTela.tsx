"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, ClipboardList, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Cabecalho } from "@/components/ui-her/Cabecalho";
import { ListaFicha } from "@/components/ui-her/ListaFicha";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";
import type { Procedimento } from "@/lib/procedimentos/types";
import { agruparPorCategoria, filtrarProcedimentos, medicosDaUnidade, type FiltrosProc as Filtros } from "@/lib/procedimentos/filtro";
import { FiltrosProc } from "./FiltrosProc";
import { ListaProc } from "./ListaProc";
import { FichaProcedimento } from "./FichaProcedimento";

const UNIDADE_PADRAO = "Hospital";

// Os dados iniciais vêm do servidor (page.tsx); `recarregar` só roda após edições.
export default function ProcedimentosTela({ initialItems, initialQ }: { initialItems: Procedimento[]; initialQ: string }) {
  const { canEdit: podeEditar } = useMenuPermission("procedimentos");
  const [items, setItems] = useState(initialItems);
  // Vindo da busca global (?q=), abre em "Todas" para achar o item em qualquer unidade.
  const [filtros, setFiltros] = useState<Filtros>({
    busca: initialQ,
    unidade: initialQ ? null : UNIDADE_PADRAO,
    tipo: null,
    medico: null,
  });
  const [aviso, setAviso] = useState("");

  const recarregar = useCallback(async () => {
    const res = await fetch("/api/procedimentos");
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.procedimentos ?? []);
  }, []);

  async function alternarAtivo(p: Procedimento) {
    await fetch(`/api/procedimentos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !p.ativo }),
    });
    recarregar();
  }

  const medicos = useMemo(() => medicosDaUnidade(items, filtros.unidade), [items, filtros.unidade]);
  const filtrados = useMemo(() => filtrarProcedimentos(items, filtros), [items, filtros]);
  const grupos = useMemo(() => agruparPorCategoria(filtrados), [filtrados]);
  const itens = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const totalUnidade = filtros.unidade === null ? items.length : items.filter((p) => p.unidade === filtros.unidade).length;
  const filtrando = filtros.busca.trim() !== "" || filtros.tipo !== null || filtros.medico !== null;
  const n = filtrando ? filtrados.length : totalUnidade;

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Procedimentos e Exames"
        subtitulo={`${n} ${n === 1 ? "item" : "itens"}`}
        acoes={podeEditar ? (
          <Button onClick={() => { /* janela de cadastro: Task 10 */ }}>
            <Plus size={15} /> Novo item
          </Button>
        ) : undefined}
      />

      {aviso && (
        <Alert>
          <AlertCircle size={16} />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{aviso}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAviso("")}>Fechar</Button>
          </AlertDescription>
        </Alert>
      )}

      <FiltrosProc filtros={filtros} onChange={setFiltros} medicos={medicos} />

      <ListaFicha
        itens={itens}
        idDe={(p) => p.id}
        tituloFicha={(p) => p.nome}
        lista={(selecionado, selecionar) => <ListaProc grupos={grupos} selecionado={selecionado} selecionar={selecionar} />}
        ficha={(p) => (
          <FichaProcedimento
            item={p}
            podeEditar={podeEditar}
            onEditar={() => { /* janela de edição: Task 10 */ }}
            onAlternarAtivo={() => alternarAtivo(p)}
          />
        )}
        vazio={
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-10 text-center text-slate-500">
            <ClipboardList size={32} className="mb-2 opacity-30" />
            <p>Nenhum item encontrado{filtros.busca.trim() ? ` para "${filtros.busca.trim()}"` : ""}.</p>
          </div>
        }
      />
    </div>
  );
}
