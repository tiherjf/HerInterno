"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Plus, Stethoscope } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Cabecalho } from "@/components/ui-her/Cabecalho";
import { ListaFicha } from "@/components/ui-her/ListaFicha";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";
import type { Profissional } from "@/lib/corpo-clinico/types";
import { agruparPorGrupo, filtrarProfissionais, type FiltrosCC as Filtros } from "@/lib/corpo-clinico/filtro";
import { FiltrosCC } from "./FiltrosCC";
import { ListaCC } from "./ListaCC";
import { FichaProfissional } from "./FichaProfissional";
import { ProfissionalDialog } from "./ProfissionalDialog";

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana em São Paulo — igual no servidor e no navegador (sem divergência na hidratação). */
function diaSemanaSP(agora: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(agora);
  return DIAS[nome] ?? agora.getDay();
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Os dados iniciais vêm do servidor (page.tsx); `recarregar` só roda após edições.
export default function CorpoClinicoTela({ initialProfissionais, initialQ }: {
  initialProfissionais: Profissional[];
  initialQ: string;
}) {
  const { canEdit: podeEditar } = useMenuPermission("corpo-clinico");
  const [profissionais, setProfissionais] = useState(initialProfissionais);
  const vazio: Filtros = { busca: "", convenio: "", unidade: null, grupo: null, hoje: false, turnos: [] };
  const [filtros, setFiltros] = useState<Filtros>({ ...vazio, busca: initialQ });
  const [aviso, setAviso] = useState("");
  const [dialog, setDialog] = useState<{ aberto: boolean; original?: Profissional }>({ aberto: false });
  const hoje = diaSemanaSP(new Date());

  const recarregar = useCallback(async () => {
    const res = await fetch("/api/corpo-clinico");
    if (!res.ok) return;
    const json = await res.json();
    setProfissionais(json.profissionais ?? []);
  }, []);

  async function remover(p: Profissional) {
    if (!confirm(`Remover "${p.nome}" do corpo clínico?`)) return;
    try {
      const res = await fetch(`/api/corpo-clinico/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error ?? "Erro ao remover.");
        return;
      }
      recarregar();
    } catch {
      alert("Falha de conexão ao remover. Tente novamente.");
    }
  }

  const grupos = useMemo(() => agruparPorGrupo(profissionais).map((g) => g.grupo), [profissionais]);
  const convenios = useMemo(() => {
    const set = new Set<string>();
    for (const p of profissionais) for (const c of p.convenios ?? []) if (c.trim()) set.add(c.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [profissionais]);

  const { principais, naoInformado } = useMemo(
    () => filtrarProfissionais(profissionais, filtros, hoje),
    [profissionais, filtros, hoje],
  );
  const gruposVisiveis = useMemo(() => agruparPorGrupo(principais), [principais]);
  // Ordem da lista na tela: seções por especialidade, depois "não informado".
  const itens = useMemo(
    () => [...gruposVisiveis.flatMap((g) => g.itens), ...naoInformado],
    [gruposVisiveis, naoInformado],
  );

  const temFiltro =
    filtros.busca.trim() !== "" || filtros.convenio.trim() !== "" || filtros.unidade !== null ||
    filtros.grupo !== null || filtros.hoje || filtros.turnos.length > 0;
  const subtitulo = filtros.convenio.trim()
    ? `${plural(principais.length, "profissional", "profissionais")} · ${naoInformado.length} a confirmar`
    : `${plural(principais.length, "profissional", "profissionais")} · ${plural(gruposVisiveis.length, "especialidade", "especialidades")}`;

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Corpo Clínico"
        subtitulo={subtitulo}
        acoes={podeEditar ? (
          <Button onClick={() => setDialog({ aberto: true })}>
            <Plus size={15} /> Novo profissional
          </Button>
        ) : undefined}
      />

      {aviso && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle size={15} className="text-amber-500" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{aviso}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-amber-800" onClick={() => setAviso("")}>Dispensar</Button>
          </AlertDescription>
        </Alert>
      )}

      <FiltrosCC
        filtros={filtros}
        onChange={setFiltros}
        grupos={grupos}
        convenios={convenios}
        temFiltro={temFiltro}
        onLimpar={() => setFiltros(vazio)}
      />

      <ListaFicha
        itens={itens}
        idDe={(p) => p.id}
        tituloFicha={(p) => p.nome}
        lista={(selecionado, selecionar) => (
          <ListaCC grupos={gruposVisiveis} naoInformado={naoInformado} hoje={hoje} selecionado={selecionado} selecionar={selecionar} />
        )}
        ficha={(p) => (
          <FichaProfissional
            prof={p}
            termoConvenio={filtros.convenio}
            hoje={hoje}
            podeEditar={podeEditar}
            onEditar={() => setDialog({ aberto: true, original: p })}
            onRemover={() => remover(p)}
          />
        )}
        vazio={
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-10 text-center text-slate-500">
            <Stethoscope size={32} className="mb-2 opacity-30" />
            <p>Nenhum profissional encontrado{filtros.busca.trim() ? ` para "${filtros.busca.trim()}"` : ""}.</p>
            {temFiltro && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setFiltros(vazio)}>Limpar filtros</Button>
            )}
          </div>
        }
      />

      <ProfissionalDialog
        aberto={dialog.aberto}
        original={dialog.original}
        grupoInicial={filtros.grupo ?? undefined}
        grupos={grupos}
        convenios={convenios}
        onFechar={() => setDialog({ aberto: false })}
        onSalvo={(a) => { setAviso(a); recarregar(); }}
      />
    </div>
  );
}
