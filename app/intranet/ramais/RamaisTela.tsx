"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Phone, Plus, Printer, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cabecalho } from "@/components/ui-her/Cabecalho";
import { CampoBusca } from "@/components/ui-her/CampoBusca";
import { Chip } from "@/components/ui-her/Chip";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";
import type { RamalItem, RamalSetor } from "@/lib/ramais/server";
import { filtrarRamais } from "@/lib/ramais/filtro";
import { RamalLinha } from "./RamalLinha";
import { SetorCaixa } from "./SetorCaixa";
import { SetorDialog } from "./SetorDialog";
import { RamalDialog } from "./RamalDialog";

// Os dados iniciais vêm do servidor (page.tsx); `recarregar` só roda após edições.
export default function RamaisTela({ initialSetores, initialMeuRamal, initialQ }: {
  initialSetores: RamalSetor[];
  initialMeuRamal: string | null;
  initialQ: string;
}) {
  const { canEdit: isAdmin } = useMenuPermission("ramais");
  const [setores, setSetores] = useState(initialSetores);
  const [meuRamal, setMeuRamal] = useState(initialMeuRamal);
  const [busca, setBusca] = useState(initialQ);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [apenasFavoritos, setApenasFavoritos] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [setorDialog, setSetorDialog] = useState<{ aberto: boolean; original?: RamalSetor }>({ aberto: false });
  const [ramalDialog, setRamalDialog] = useState<{ aberto: boolean; original?: RamalItem; setorId?: string }>({ aberto: false });

  const recarregar = useCallback(async () => {
    const res = await fetch("/api/ramais");
    if (!res.ok) return;
    const json = await res.json();
    setSetores(json.setores ?? []);
    setMeuRamal(json.meu_ramal ?? null);
  }, []);

  async function copiar(numero: string) {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(numero);
      setTimeout(() => setCopiado((c) => (c === numero ? null : c)), 1500);
    } catch { /* sem permissão de área de transferência */ }
  }

  async function alternarFavorito(r: RamalItem) {
    const res = await fetch(`/api/ramais/favoritos/${r.id}`, { method: r.favorito ? "DELETE" : "POST" });
    if (!res.ok) return;
    setSetores((prev) => prev.map((s) => ({
      ...s,
      ramais: s.ramais.map((x) => (x.id === r.id ? { ...x, favorito: !x.favorito } : x)),
    })));
  }

  async function removerSetor(s: RamalSetor) {
    if (!confirm(`Desativar o setor "${s.name}"? Os ramais serão removidos junto.`)) return;
    await fetch(`/api/ramais/setores/${s.id}`, { method: "DELETE" });
    recarregar();
  }

  async function removerRamal(r: RamalItem) {
    if (!confirm(`Remover o ramal "${r.descricao}"?`)) return;
    await fetch(`/api/ramais/itens/${r.id}`, { method: "DELETE" });
    recarregar();
  }

  const totalRamais = useMemo(() => setores.reduce((n, s) => n + s.ramais.length, 0), [setores]);
  const favoritos = useMemo(() => setores.flatMap((s) => s.ramais.filter((r) => r.favorito)), [setores]);
  const filtrados = useMemo(
    () => filtrarRamais(setores, { busca, setorId, apenasFavoritos }),
    [setores, busca, setorId, apenasFavoritos],
  );
  const totalFiltrado = filtrados.reduce((n, s) => n + s.ramais.length, 0);
  const filtrando = busca.trim() !== "" || setorId !== null || apenasFavoritos;

  const linha = (r: RamalItem) => (
    <RamalLinha
      key={r.id}
      ramal={r}
      isAdmin={isAdmin}
      copiado={copiado === r.numero}
      onCopiar={() => copiar(r.numero)}
      onFavorito={() => alternarFavorito(r)}
      onEditar={() => setRamalDialog({ aberto: true, original: r })}
      onRemover={() => removerRamal(r)}
    />
  );

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Ramais"
        subtitulo={`${setores.length} setores · ${totalRamais} ramais`}
        acoes={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={15} /> Imprimir
            </Button>
            {isAdmin && (
              <Button onClick={() => setSetorDialog({ aberto: true })}>
                <Plus size={15} /> Novo setor
              </Button>
            )}
          </>
        }
      />

      <div className="sticky top-0 z-10 -mx-4 flex gap-2 bg-background/95 px-4 py-2 backdrop-blur no-print sm:-mx-6 sm:px-6">
        <CampoBusca
          className="flex-1"
          value={busca}
          onChange={setBusca}
          placeholder="Buscar ramal, nome ou setor..."
        />
        <Button
          variant="outline"
          aria-pressed={apenasFavoritos}
          onClick={() => setApenasFavoritos((v) => !v)}
          className={`h-10 shrink-0 ${apenasFavoritos ? "border-primary/30 bg-accent text-primary" : ""}`}
        >
          <Star size={14} className={apenasFavoritos ? "fill-current" : ""} /> Favoritos
        </Button>
      </div>

      {meuRamal && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-accent/60 px-4 py-3">
          <Phone size={16} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meu ramal</span>
          <span className="text-xl font-bold tabular-nums text-primary">{meuRamal}</span>
          <button
            type="button"
            onClick={() => copiar(meuRamal)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-accent no-print"
          >
            {copiado === meuRamal ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 no-print">
        <Chip ativo={setorId === null} onClick={() => setSetorId(null)}>Todos {totalRamais}</Chip>
        {setores.map((s) => (
          <Chip key={s.id} ativo={setorId === s.id} onClick={() => setSetorId(setorId === s.id ? null : s.id)}>
            {s.name} {s.ramais.length}
          </Chip>
        ))}
      </div>

      {filtrando && (
        <p className="text-xs text-slate-500 no-print">
          {totalFiltrado} {totalFiltrado === 1 ? "ramal" : "ramais"}
        </p>
      )}

      <div className="columns-1 gap-4 lg:columns-2">
        {favoritos.length > 0 && !filtrando && (
          <SetorCaixa
            titulo="Favoritos"
            quantidade={favoritos.length}
            icone={<Star size={14} className="fill-amber-400 text-amber-500" />}
          >
            {favoritos.map(linha)}
          </SetorCaixa>
        )}
        {filtrados.map((s) => (
          <SetorCaixa
            key={s.id}
            titulo={s.name}
            quantidade={s.ramais.length}
            acoesAdmin={isAdmin ? {
              onAdicionar: () => setRamalDialog({ aberto: true, setorId: s.id }),
              onEditar: () => setSetorDialog({ aberto: true, original: setores.find((x) => x.id === s.id) }),
              onRemover: () => removerSetor(s),
            } : undefined}
          >
            {s.ramais.map(linha)}
          </SetorCaixa>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Phone size={36} className="mb-3 opacity-20" />
          <p>{busca.trim() ? `Nenhum ramal encontrado para "${busca.trim()}".` : "Nenhum ramal encontrado."}</p>
        </div>
      )}

      <SetorDialog
        aberto={setorDialog.aberto}
        original={setorDialog.original}
        onFechar={() => setSetorDialog({ aberto: false })}
        onSalvo={recarregar}
      />
      <RamalDialog
        aberto={ramalDialog.aberto}
        original={ramalDialog.original}
        setorInicial={ramalDialog.setorId}
        setores={setores}
        onFechar={() => setRamalDialog({ aberto: false })}
        onSalvo={recarregar}
      />
    </div>
  );
}
