"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, Phone, Copy, Check, Download, Star, Plus, Edit2, Trash2,
  Loader2, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";

// ─── Cores disponíveis ──────────────────────────────────────
const CORES: Record<string, { header: string; chip: string; dot: string }> = {
  blue:   { header: "bg-blue-600 text-white",   chip: "bg-blue-50 border-blue-200 text-blue-700",     dot: "bg-blue-500" },
  purple: { header: "bg-purple-600 text-white", chip: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-500" },
  teal:   { header: "bg-teal-600 text-white",   chip: "bg-teal-50 border-teal-200 text-teal-700",     dot: "bg-teal-500" },
  orange: { header: "bg-orange-600 text-white", chip: "bg-orange-50 border-orange-200 text-orange-700", dot: "bg-orange-500" },
  indigo: { header: "bg-indigo-600 text-white", chip: "bg-indigo-50 border-indigo-200 text-indigo-700", dot: "bg-indigo-500" },
  green:  { header: "bg-green-600 text-white",  chip: "bg-green-50 border-green-200 text-green-700",   dot: "bg-green-500" },
  rose:   { header: "bg-rose-600 text-white",   chip: "bg-rose-50 border-rose-200 text-rose-700",     dot: "bg-rose-500" },
  cyan:   { header: "bg-cyan-600 text-white",   chip: "bg-cyan-50 border-cyan-200 text-cyan-700",     dot: "bg-cyan-500" },
  amber:  { header: "bg-amber-600 text-white",  chip: "bg-amber-50 border-amber-200 text-amber-700",   dot: "bg-amber-500" },
  red:    { header: "bg-red-600 text-white",    chip: "bg-red-50 border-red-200 text-red-700",         dot: "bg-red-500" },
};

// ─── Tipos ──────────────────────────────────────────────────
interface Ramal {
  id: string;
  setor_id: string;
  numero: string;
  descricao: string;
  order_index: number;
  favorito: boolean;
}
interface Setor {
  id: string;
  name: string;
  icon: string;
  color: string;
  order_index: number;
  ramais: Ramal[];
}

// ─── Dialog de Setor ────────────────────────────────────────
function SetorDialog({ open, initial, onClose, onSaved }: {
  open: boolean;
  initial?: Partial<Setor>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "📞");
  const [color, setColor] = useState(initial?.color ?? "blue");
  const [order, setOrder] = useState(String(initial?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? "📞");
      setColor(initial?.color ?? "blue");
      setOrder(String(initial?.order_index ?? 0));
      setError("");
    }
  }, [open, initial]);

  async function save() {
    if (!name.trim()) { setError("Nome obrigatório."); return; }
    setSaving(true);
    const url = isEdit ? `/api/ramais/setores/${initial!.id}` : "/api/ramais/setores";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon, color, order_index: Number(order) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Erro."); setSaving(false); return; }
    onSaved(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? "Editar setor" : "Novo setor"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Térreo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ícone (emoji)</Label>
              <Input value={icon} onChange={e => setIcon(e.target.value)} placeholder="📞" />
            </div>
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <Input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CORES).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  className={`w-7 h-7 rounded-full ${c.dot} ring-offset-2 transition-all ${color === key ? "ring-2 ring-primary" : ""}`}
                  title={key}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de Ramal ────────────────────────────────────────
function RamalDialog({ open, initial, setores, defaultSetorId, onClose, onSaved }: {
  open: boolean;
  initial?: Partial<Ramal>;
  setores: Setor[];
  defaultSetorId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [setorId, setSetorId] = useState(initial?.setor_id ?? defaultSetorId ?? "");
  const [order, setOrder] = useState(String(initial?.order_index ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNumero(initial?.numero ?? "");
      setDescricao(initial?.descricao ?? "");
      setSetorId(initial?.setor_id ?? defaultSetorId ?? "");
      setOrder(String(initial?.order_index ?? 0));
      setError("");
    }
  }, [open, initial, defaultSetorId]);

  async function save() {
    if (!numero.trim() || !descricao.trim() || !setorId) {
      setError("Todos os campos são obrigatórios."); return;
    }
    setSaving(true);
    const url = isEdit ? `/api/ramais/itens/${initial!.id}` : "/api/ramais/itens";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setor_id: setorId, numero, descricao, order_index: Number(order) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Erro."); setSaving(false); return; }
    onSaved(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? "Editar ramal" : "Adicionar ramal"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <select
              value={setorId}
              onChange={e => setSetorId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Selecione...</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Número do ramal *</Label>
            <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 4936" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: TI (Alexandre, Gabriel, Mateus)" />
          </div>
          <div className="space-y-1.5">
            <Label>Ordem</Label>
            <Input type="number" min={0} value={order} onChange={e => setOrder(e.target.value)} className="w-24" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin mr-2" />}
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ────────────────────────────────────────
export default function RamaisPage() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [meuRamal, setMeuRamal] = useState<string | null>(null);
  const { canEdit: isAdmin } = useMenuPermission("ramais");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [setorAtivo, setSetorAtivo] = useState("todos");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [apenasGravados, setApenasGravados] = useState(false);

  // Dialogs
  const [setorDialog, setSetorDialog] = useState<{ open: boolean; initial?: Partial<Setor> }>({ open: false });
  const [ramalDialog, setRamalDialog] = useState<{ open: boolean; initial?: Partial<Ramal>; setorId?: string }>({ open: false });

  const load = useCallback(async () => {
    try {
      const ramRes = await fetch("/api/ramais");
      const ramData = await ramRes.json();
      setSetores(ramData.setores ?? []);
      setMeuRamal(ramData.meu_ramal ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function copiar(numero: string) {
    if (numero === "N/A") return;
    await navigator.clipboard.writeText(numero);
    setCopiado(numero);
    setTimeout(() => setCopiado(null), 1500);
  }

  async function toggleFavorito(ramal: Ramal) {
    const method = ramal.favorito ? "DELETE" : "POST";
    const res = await fetch(`/api/ramais/favoritos/${ramal.id}`, { method });
    if (res.ok) {
      setSetores(prev => prev.map(s => ({
        ...s,
        ramais: s.ramais.map(r => r.id === ramal.id ? { ...r, favorito: !r.favorito } : r),
      })));
    }
  }

  async function deleteSetor(id: string, name: string) {
    if (!confirm(`Desativar o setor "${name}"? Os ramais serão removidos junto.`)) return;
    await fetch(`/api/ramais/setores/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteRamal(id: string, descricao: string) {
    if (!confirm(`Remover o ramal "${descricao}"?`)) return;
    await fetch(`/api/ramais/itens/${id}`, { method: "DELETE" });
    load();
  }

  const todosRamais = useMemo(() => setores.flatMap(s => s.ramais), [setores]);
  const favoritos = useMemo(() => todosRamais.filter(r => r.favorito), [todosRamais]);
  const totalRamais = todosRamais.length;

  const setoresFiltrados = useMemo(() => {
    const termo = search.toLowerCase().trim();
    return setores
      .filter(s => setorAtivo === "todos" || s.id === setorAtivo)
      .map(s => ({
        ...s,
        ramais: s.ramais.filter(r => {
          if (apenasGravados && !r.favorito) return false;
          if (!termo) return true;
          return r.numero.toLowerCase().includes(termo) || r.descricao.toLowerCase().includes(termo);
        }),
      }))
      .filter(s => s.ramais.length > 0);
  }, [setores, search, setorAtivo, apenasGravados]);

  const totalFiltrado = setoresFiltrados.reduce((a, s) => a + s.ramais.length, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="brand-gradient rounded-xl p-5 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg shrink-0">
              <Phone size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Lista de Ramais</h2>
              <p className="text-primary-foreground/70 text-sm">
                {setores.length} setores · {totalRamais} ramais cadastrados
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Button
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 border"
                onClick={() => setSetorDialog({ open: true })}
              >
                <Plus size={14} className="mr-1.5" /> Novo Setor
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 border no-print"
              onClick={() => window.print()}
            >
              <Download size={14} className="mr-1.5" /> Imprimir / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Meu Ramal */}
      {meuRamal && (
        <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
          <div className="p-2.5 bg-primary/10 rounded-lg">
            <Phone size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meu ramal</p>
            <p className="text-2xl font-bold text-primary tabular-nums">{meuRamal}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copiar(meuRamal)}
            className={copiado === meuRamal ? "border-green-300 text-green-700" : ""}
          >
            {copiado === meuRamal ? <><Check size={13} className="mr-1.5" />Copiado</> : <><Copy size={13} className="mr-1.5" />Copiar</>}
          </Button>
        </div>
      )}

      {/* Favoritos */}
      {favoritos.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border-b">
            <Star size={15} className="text-yellow-500 fill-yellow-400" />
            <h3 className="font-semibold text-sm text-yellow-800">Favoritos ({favoritos.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y">
            {favoritos.map(r => (
              <RamalItem
                key={r.id} ramal={r}
                isAdmin={isAdmin}
                copiado={copiado}
                onCopiar={copiar}
                onFavorito={toggleFavorito}
                onEdit={() => setRamalDialog({ open: true, initial: r })}
                onDelete={() => deleteRamal(r.id, r.descricao)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Busca sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 no-print">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por ramal, nome ou setor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant={apenasGravados ? "default" : "outline"}
            onClick={() => setApenasGravados(v => !v)}
            className="shrink-0 gap-1.5"
          >
            <Star size={13} className={apenasGravados ? "fill-current" : ""} />
            Favoritos
          </Button>
        </div>
        {search && (
          <p className="text-xs text-muted-foreground mt-1.5 pl-1">
            {totalFiltrado} resultado{totalFiltrado !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Filtros por setor */}
      <div className="flex flex-wrap gap-2 no-print">
        <button
          onClick={() => setSetorAtivo("todos")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${setorAtivo === "todos" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
        >
          Todos ({totalRamais})
        </button>
        {setores.map(s => (
          <button
            key={s.id}
            onClick={() => setSetorAtivo(setorAtivo === s.id ? "todos" : s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${setorAtivo === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
          >
            {s.icon} {s.name} ({s.ramais.length})
          </button>
        ))}
      </div>

      {setoresFiltrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Phone size={40} className="mb-3 opacity-20" />
          <p>{search ? `Nenhum ramal encontrado para "${search}"` : "Nenhum ramal encontrado."}</p>
        </div>
      )}

      {/* Listas por setor */}
      <div className="space-y-5">
        {setoresFiltrados.map(setor => {
          const cores = CORES[setor.color] ?? CORES.blue;
          return (
            <div key={setor.id} className="rounded-xl border bg-white shadow-sm overflow-hidden print:break-inside-avoid">
              <div className={`flex items-center justify-between px-4 py-3 ${cores.header}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{setor.icon}</span>
                  <h3 className="font-bold text-sm">{setor.name}</h3>
                  <span className="text-xs opacity-90 bg-white/20 px-2 py-0.5 rounded-full">
                    {setor.ramais.length} ramal{setor.ramais.length !== 1 ? "is" : ""}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 no-print">
                    <button
                      onClick={() => setRamalDialog({ open: true, setorId: setor.id })}
                      className="p-1.5 rounded bg-white/20 hover:bg-white/30 text-white"
                      title="Adicionar ramal"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => setSetorDialog({ open: true, initial: setor })}
                      className="p-1.5 rounded bg-white/20 hover:bg-white/30 text-white"
                      title="Editar setor"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => deleteSetor(setor.id, setor.name)}
                      className="p-1.5 rounded bg-white/20 hover:bg-white/30 text-white"
                      title="Remover setor"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y">
                {setor.ramais.map(r => (
                  <RamalItem
                    key={r.id} ramal={r}
                    isAdmin={isAdmin}
                    copiado={copiado}
                    onCopiar={copiar}
                    onFavorito={toggleFavorito}
                    onEdit={() => setRamalDialog({ open: true, initial: r })}
                    onDelete={() => deleteRamal(r.id, r.descricao)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <SetorDialog
        open={setorDialog.open}
        initial={setorDialog.initial}
        onClose={() => setSetorDialog({ open: false })}
        onSaved={load}
      />
      <RamalDialog
        open={ramalDialog.open}
        initial={ramalDialog.initial}
        setores={setores}
        defaultSetorId={ramalDialog.setorId}
        onClose={() => setRamalDialog({ open: false })}
        onSaved={load}
      />
    </div>
  );
}

// ─── Componente de item de ramal ─────────────────────────────
function RamalItem({ ramal, isAdmin, copiado, onCopiar, onFavorito, onEdit, onDelete }: {
  ramal: Ramal;
  isAdmin: boolean;
  copiado: string | null;
  onCopiar: (n: string) => void;
  onFavorito: (r: Ramal) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const semRamal = ramal.numero === "N/A";
  const isCopiado = copiado === ramal.numero;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0">
      {/* Número */}
      <div className={`shrink-0 flex items-center justify-center min-w-18 h-11 rounded-lg font-bold tabular-nums text-base px-2 ${
        semRamal ? "bg-gray-100 text-gray-400 text-sm" : "bg-blue-50 text-blue-700 border border-blue-200"
      }`}>
        {semRamal ? "—" : ramal.numero}
      </div>

      {/* Descrição */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-tight">{ramal.descricao}</p>
      </div>

      {/* Ações */}
      <div className="shrink-0 flex items-center gap-1 no-print">
        {/* Favorito */}
        <button
          onClick={() => onFavorito(ramal)}
          className={`p-1.5 rounded-md transition-colors ${ramal.favorito ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-400 opacity-0 group-hover:opacity-100"}`}
          title={ramal.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star size={14} className={ramal.favorito ? "fill-yellow-400" : ""} />
        </button>

        {/* Admin: edit + delete (aparecem no hover) */}
        {isAdmin && (
          <>
            <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">
              <Edit2 size={13} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
              <Trash2 size={13} />
            </button>
          </>
        )}

        {/* Copiar */}
        {!semRamal && (
          <button
            onClick={() => onCopiar(ramal.numero)}
            title="Copiar ramal"
            className={`p-1.5 rounded-md border transition-colors ${
              isCopiado ? "border-green-200 bg-green-50 text-green-600" : "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600"
            }`}
          >
            {isCopiado ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
