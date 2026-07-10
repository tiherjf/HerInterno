"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2, Plus, Pencil, AlertCircle, CalendarClock, PlayCircle, CheckCircle2,
} from "lucide-react";

interface Category { id: string; name: string; team: string; active?: boolean }
interface Plan {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  equipment_patrimonio: string | null;
  category_id: string | null;
  category: { id: string; name: string; color: string | null } | null;
  frequency_days: number;
  next_due: string;
  active: boolean;
  last_generated_at: string | null;
}
interface GerarSummary { generated: number; skipped: number; plans: number }

const EMPTY_FORM = {
  title: "",
  description: "",
  location: "",
  equipment_patrimonio: "",
  category_id: "none",
  frequency_days: "30",
  next_due: "",
};

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PreventivasPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMigration, setPendingMigration] = useState(false);
  const [pageError, setPageError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Plan | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<GerarSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const r = await fetch("/api/chamados/preventivas");
      const d = await r.json();
      if (!r.ok) { setPageError(d.error || "Erro ao carregar planos."); return; }
      setPendingMigration(d.pending_migration === true);
      setPlans(d.plans || []);
    } catch {
      setPageError("Erro de rede ao carregar planos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // A rota de categorias não aceita ?team= — filtra manutenção no cliente
    fetch("/api/chamados/categorias")
      .then((r) => r.json())
      .then((d) => setCategories((d.categories || []).filter((c: Category) => c.team === "manutencao")))
      .catch(() => {});
  }, [load]);

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, next_due: todayISO() });
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(p: Plan) {
    setEditItem(p);
    setForm({
      title: p.title,
      description: p.description || "",
      location: p.location || "",
      equipment_patrimonio: p.equipment_patrimonio || "",
      category_id: p.category_id || "none",
      frequency_days: String(p.frequency_days),
      next_due: p.next_due,
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.title.trim()) { setFormError("Informe o título."); return; }
    if (!form.location.trim()) { setFormError("Informe a localização."); return; }
    const freq = Number(form.frequency_days);
    if (!Number.isInteger(freq) || freq < 1) { setFormError("Frequência deve ser um número inteiro de dias (mínimo 1)."); return; }
    if (!form.next_due) { setFormError("Informe a próxima execução."); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        location: form.location,
        equipment_patrimonio: form.equipment_patrimonio || null,
        category_id: form.category_id === "none" ? null : form.category_id,
        frequency_days: freq,
        next_due: form.next_due,
      };
      const r = await fetch(
        editItem ? `/api/chamados/preventivas/${editItem.id}` : "/api/chamados/preventivas",
        {
          method: editItem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const d = await r.json();
      if (!r.ok) { setFormError(d.error || "Erro ao salvar."); return; }
      if (d.pending_migration) { setPendingMigration(true); setDialogOpen(false); return; }
      setDialogOpen(false);
      load();
    } catch {
      setFormError("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Plan) {
    setPageError("");
    try {
      const r = await fetch(`/api/chamados/preventivas/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      const d = await r.json();
      if (!r.ok) { setPageError(d.error || "Erro ao atualizar plano."); return; }
      load();
    } catch {
      setPageError("Erro de rede ao atualizar plano.");
    }
  }

  async function deactivate(p: Plan) {
    setPageError("");
    try {
      const r = await fetch(`/api/chamados/preventivas/${p.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) { setPageError(d.error || "Erro ao desativar plano."); return; }
      load();
    } catch {
      setPageError("Erro de rede ao desativar plano.");
    }
  }

  async function handleGerar() {
    setGenerating(true);
    setSummary(null);
    setPageError("");
    try {
      const r = await fetch("/api/chamados/preventivas/gerar");
      const d = await r.json();
      if (!r.ok) { setPageError(d.error || "Erro ao gerar chamados."); return; }
      if (d.pending_migration) { setPendingMigration(true); return; }
      setSummary({ generated: d.generated ?? 0, skipped: d.skipped ?? 0, plans: d.plans ?? 0 });
      load();
    } catch {
      setPageError("Erro de rede ao gerar chamados.");
    } finally {
      setGenerating(false);
    }
  }

  const hoje = todayISO();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock size={24} /> Manutenção Preventiva
          </h2>
          <p className="text-muted-foreground">
            Planos que geram chamados de manutenção automaticamente na data programada
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleGerar} disabled={generating || pendingMigration}>
            {generating ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            Gerar agora
          </Button>
          <Button size="sm" onClick={openCreate} disabled={pendingMigration}>
            <Plus size={14} /> Novo Plano
          </Button>
        </div>
      </div>

      {pendingMigration && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migração pendente</AlertTitle>
          <AlertDescription>
            A tabela de planos preventivos ainda não existe. Aplique a migração{" "}
            <code className="font-mono text-xs">041_chamados_melhorias.sql</code> no SQL Editor do Supabase.
          </AlertDescription>
        </Alert>
      )}

      {pageError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Geração concluída</AlertTitle>
          <AlertDescription>
            {summary.plans === 0
              ? "Nenhum plano vencido — nada a gerar."
              : `${summary.plans} plano(s) vencido(s): ${summary.generated} chamado(s) gerado(s), ${summary.skipped} pulado(s) por já terem chamado em aberto.`}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        !pendingMigration && (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarClock size={40} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum plano preventivo cadastrado.</p>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Próxima execução</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{p.location || "—"}</TableCell>
                  <TableCell>{p.equipment_patrimonio || "—"}</TableCell>
                  <TableCell>
                    {p.category ? (
                      <Badge variant="secondary" className="text-xs">{p.category.name}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>a cada {p.frequency_days} dia{p.frequency_days > 1 ? "s" : ""}</TableCell>
                  <TableCell>
                    {p.active && p.next_due <= hoje ? (
                      <Badge className="text-xs bg-red-100 text-red-700 border-0">
                        {fmtDate(p.next_due)} · vencida
                      </Badge>
                    ) : (
                      fmtDate(p.next_due)
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Editar">
                        <Pencil size={14} />
                      </Button>
                      {p.active ? (
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deactivate(p)}>
                          Desativar
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => toggleActive(p)}>
                          Ativar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Plano" : "Novo Plano Preventivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Limpeza dos filtros do ar-condicionado"
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Instruções do serviço (opcional)"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Localização *</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Ex: UTI — 2º andar"
                />
              </div>
              <div className="space-y-1">
                <Label>Patrimônio</Label>
                <Input
                  value={form.equipment_patrimonio}
                  onChange={(e) => setForm({ ...form, equipment_patrimonio: e.target.value })}
                  placeholder="Nº patrimônio (opcional)"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Frequência (dias) *</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.frequency_days}
                  onChange={(e) => setForm({ ...form, frequency_days: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Próxima execução *</Label>
                <Input
                  type="date"
                  min={hoje}
                  value={form.next_due}
                  onChange={(e) => setForm({ ...form, next_due: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
