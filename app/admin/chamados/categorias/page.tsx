"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2, Plus, Pencil, Trash2, AlertCircle, Tag, Clock, ArrowLeft, RotateCcw,
} from "lucide-react";
import Link from "next/link";

// ── tipos ──────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  color: string;
  sla_hours: number;
  ola_hours: number | null;
  team: string;
  default_priority: string | null;
  active: boolean;
}

// ── constantes ─────────────────────────────────────────────────────────────
const PRIORITY_OPTIONS = [
  { value: "low",       label: "Baixa",       color: "bg-blue-100 text-blue-700" },
  { value: "medium",    label: "Média",       color: "bg-yellow-100 text-yellow-700" },
  { value: "high",      label: "Alta",        color: "bg-orange-100 text-orange-700" },
  { value: "critical",  label: "Urgente",     color: "bg-red-100 text-red-700" },
  { value: "scheduled", label: "A Programar", color: "bg-gray-200 text-gray-600" },
];
const PRIORITY_BY_VALUE = Object.fromEntries(PRIORITY_OPTIONS.map(p => [p.value, p]));

const TEAM_TABS = [
  { key: "ti",         label: "TI" },
  { key: "manutencao", label: "Manutenção" },
  { key: "marketing",  label: "Marketing" },
];
const TEAM_LABEL: Record<string, string> = { ti: "TI", manutencao: "Manutenção", marketing: "Marketing" };
const TEAM_BADGE: Record<string, string> = {
  ti: "bg-blue-100 text-blue-700",
  manutencao: "bg-orange-100 text-orange-700",
  marketing: "bg-pink-100 text-pink-700",
};

const EMPTY_FORM = {
  name: "",
  color: "#3b82f6",
  sla_hours: "24",
  ola_hours: "",
  team: "ti",
  default_priority: "medium",
};

// ── página ──────────────────────────────────────────────────────────────────
export default function CategoriasChamadosPage() {
  const [role, setRole] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageAviso, setPageAviso] = useState("");
  const [teamTab, setTeamTab] = useState("ti");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteItem, setDeleteItem] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === "admin";
  // Papéis de equipe só gerenciam a própria fila (o servidor também restringe)
  const teamRole = role && ["ti", "manutencao", "marketing"].includes(role) ? role : null;

  useEffect(() => {
    fetch("/api/perfil")
      .then(r => r.json())
      .then(d => setRole(d.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const r = await fetch("/api/chamados/categorias?all=true");
      const d = await r.json();
      if (!r.ok) { setPageError(d.error || "Erro ao carregar categorias."); return; }
      if (d.aviso) setPageAviso(d.aviso);
      setCategories(d.categories || []);
    } catch {
      setPageError("Erro de rede ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Para admin, as abas de equipe filtram no cliente; para papéis de equipe o
  // servidor já retorna apenas a própria fila.
  const visible = isAdmin ? categories.filter(c => c.team === teamTab) : categories;

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, team: isAdmin ? teamTab : (teamRole ?? "ti") });
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditItem(cat);
    setForm({
      name: cat.name,
      color: cat.color || "#3b82f6",
      sla_hours: String(cat.sla_hours ?? 24),
      ola_hours: cat.ola_hours != null ? String(cat.ola_hours) : "",
      team: cat.team,
      default_priority: cat.default_priority && PRIORITY_BY_VALUE[cat.default_priority]
        ? cat.default_priority
        : "medium",
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.name.trim()) { setFormError("Informe o nome da categoria."); return; }
    const sla = Number(form.sla_hours);
    if (!Number.isFinite(sla) || sla < 1) { setFormError("SLA deve ser um número de horas (mínimo 1)."); return; }
    let ola: number | null = null;
    if (form.ola_hours !== "") {
      ola = Number(form.ola_hours);
      if (!Number.isFinite(ola) || ola <= 0) { setFormError("OLA deve ser um número de horas maior que zero."); return; }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        color: form.color,
        sla_hours: sla,
        ola_hours: ola,
        team: form.team,
        default_priority: form.default_priority,
      };
      const r = await fetch(
        editItem ? `/api/chamados/categorias/${editItem.id}` : "/api/chamados/categorias",
        {
          method: editItem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const d = await r.json().catch(() => null);
      if (!r.ok) { setFormError(d?.error || "Erro ao salvar categoria."); return; }
      if (d?.aviso) setPageAviso(d.aviso);
      setDialogOpen(false);
      load();
    } catch {
      setFormError("Erro de rede ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    setPageError("");
    try {
      const r = await fetch(`/api/chamados/categorias/${deleteItem.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setPageError(d?.error || "Erro ao excluir categoria."); return; }
      if (d?.aviso) setPageAviso(d.aviso);
      setDeleteItem(null);
      load();
    } catch {
      setPageError("Erro de rede ao excluir categoria.");
    } finally {
      setDeleting(false);
    }
  }

  async function reactivate(cat: Category) {
    setPageError("");
    try {
      const r = await fetch(`/api/chamados/categorias/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setPageError(d?.error || "Erro ao reativar categoria."); return; }
      load();
    } catch {
      setPageError("Erro de rede ao reativar categoria.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={24} /> Categorias &amp; SLA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as categorias de chamados, prazos de SLA/OLA e prioridade padrão
            {teamRole && !isAdmin ? ` da equipe ${TEAM_LABEL[teamRole]}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/chamados">
            <Button variant="outline" size="sm"><ArrowLeft size={14} /> Chamados</Button>
          </Link>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Nova Categoria
          </Button>
        </div>
      </div>

      {/* Abas de equipe — apenas admin vê todas as filas */}
      {isAdmin && (
        <div className="flex gap-2 flex-wrap">
          {TEAM_TABS.map(t => (
            <Button
              key={t.key}
              size="sm"
              variant={teamTab === t.key ? "default" : "outline"}
              onClick={() => setTeamTab(t.key)}
              className="rounded-full"
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {pageAviso && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>{pageAviso}</AlertDescription>
        </Alert>
      )}

      {pageError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag size={40} className="mx-auto mb-2 opacity-30" />
          <p>Nenhuma categoria cadastrada{isAdmin ? ` para ${TEAM_LABEL[teamTab]}` : ""}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {isAdmin && <TableHead className="hidden md:table-cell">Equipe</TableHead>}
                <TableHead className="hidden sm:table-cell">SLA (h)</TableHead>
                <TableHead className="hidden lg:table-cell">OLA (h)</TableHead>
                <TableHead className="hidden md:table-cell">Prioridade padrão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(cat => {
                const prio = cat.default_priority ? PRIORITY_BY_VALUE[cat.default_priority] : null;
                return (
                  <TableRow key={cat.id} className={!cat.active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: cat.color }} />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="hidden md:table-cell">
                        <Badge className={`text-xs border-0 ${TEAM_BADGE[cat.team] ?? "bg-gray-100 text-gray-700"}`}>
                          {TEAM_LABEL[cat.team] ?? cat.team}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="hidden sm:table-cell">
                      <span className="flex items-center gap-1"><Clock size={12} />{cat.sla_hours}h</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {cat.ola_hours != null
                        ? <span className="flex items-center gap-1"><Clock size={12} />{cat.ola_hours}h</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {prio
                        ? <Badge className={`text-xs border-0 ${prio.color}`}>{prio.label}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${cat.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {cat.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(cat)} title="Editar">
                          <Pencil size={14} />
                        </Button>
                        {cat.active ? (
                          <Button
                            size="sm" variant="ghost"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setDeleteItem(cat)}
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </Button>
                        ) : (
                          <Button
                            size="sm" variant="ghost"
                            className="text-gray-400 hover:text-green-600"
                            onClick={() => reactivate(cat)}
                            title="Reativar"
                          >
                            <RotateCcw size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag size={16} /> {editItem ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Suporte a Sistemas"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Equipe</Label>
                {isAdmin ? (
                  <Select value={form.team} onValueChange={v => setForm(p => ({ ...p, team: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ti">TI</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-9 flex items-center">
                    <Badge className={`text-xs border-0 ${TEAM_BADGE[form.team] ?? "bg-gray-100 text-gray-700"}`}>
                      {TEAM_LABEL[form.team] ?? form.team}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-12 p-0.5 cursor-pointer"
                    value={form.color}
                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  />
                  <span className="text-xs font-mono text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SLA (horas) *</Label>
                <Input
                  type="number" min="1" step="1" placeholder="24"
                  value={form.sla_hours}
                  onChange={e => setForm(p => ({ ...p, sla_hours: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">Prazo máximo de resolução</p>
              </div>
              <div className="space-y-1.5">
                <Label>OLA (horas)</Label>
                <Input
                  type="number" min="0.5" step="0.5" placeholder="Opcional"
                  value={form.ola_hours}
                  onChange={e => setForm(p => ({ ...p, ola_hours: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">Meta interna de primeira resposta</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade padrão</Label>
              <Select value={form.default_priority} onValueChange={v => setForm(p => ({ ...p, default_priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Aplicada automaticamente aos chamados desta categoria. &quot;A Programar&quot; não tem prazo de SLA.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                : editItem ? "Salvar" : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar exclusão */}
      <Dialog open={!!deleteItem} onOpenChange={v => { if (!v) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Excluir categoria?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A categoria <strong>{deleteItem?.name}</strong> será desativada e deixará de aparecer
            para novos chamados. Chamados existentes não são afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Voltar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 size={14} className="animate-spin" /> Excluindo...</> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
