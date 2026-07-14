"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2, XCircle, Loader2, Plus, Pencil, Download,
  AlertCircle, Paperclip, Clock, TrendingUp, TrendingDown, Search,
  Lock, Unlock, CheckSquare, Square, History,
} from "lucide-react";

interface Justification {
  id: string; occurrence_date: string; is_full_day: boolean;
  start_time: string | null; end_time: string | null;
  description: string; document_url: string | null;
  deadline: string; status: string; created_at: string;
  manager_observation: string | null; rh_observation: string | null;
  profiles: { full_name: string; sector: string };
  justification_types: { name: string };
}
interface HistoryEntry {
  id: string; actor_name: string; action: string;
  previous_status: string | null; new_status: string;
  observation: string | null; created_at: string;
}
interface JType {
  id: string; name: string; description: string | null;
  requires_document: boolean; allows_partial_day: boolean; active: boolean;
}
interface HourRecord {
  id: string; user_id: string; reference_month: string;
  overtime_minutes: number; description: string | null;
  profiles: { full_name: string; sector: string };
}
interface Profile { id: string; full_name: string; sector: string }
interface Fechamento {
  id: string; reference_month: string; closed_by_name: string;
  notes: string | null; closed_at: string;
}

function fmt(d: string) { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR"); }
function minutesToHHMM(m: number) {
  const abs = Math.abs(m);
  return `${Math.floor(abs / 60)}h${abs % 60 > 0 ? ` ${abs % 60}min` : ""}`;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  created:           { label: "Enviada",           color: "text-gray-600" },
  manager_approved:  { label: "Aprovada (Gestor)", color: "text-blue-700" },
  manager_rejected:  { label: "Recusada (Gestor)", color: "text-red-700" },
  rh_approve:        { label: "Aprovada (RH)",     color: "text-green-700" },
  rh_reject:         { label: "Recusada (RH)",     color: "text-red-700" },
};

// ─────────────────────────────────────────────
// TAB: APROVAÇÕES RH (com lote + histórico)
// ─────────────────────────────────────────────
function ApprovacoesRH() {
  const [items, setItems] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Justification | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyModal, setHistoryModal] = useState<{ item: Justification; entries: HistoryEntry[] } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);
  const [batchObs, setBatchObs] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setChecked(new Set());
    try {
      const r = await fetch("/api/ponto/justificativas?view=pending_rh");
      const d = await r.json();
      setItems(d.justifications || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openHistory = async (j: Justification) => {
    setLoadingHistory(true);
    const r = await fetch(`/api/ponto/justificativas/${j.id}`);
    const d = await r.json();
    setHistoryModal({ item: j, entries: d.history ?? [] });
    setLoadingHistory(false);
  };

  function toggleCheck(id: string) {
    setChecked(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  async function handleAction() {
    if (!selected || !action) return;
    if (action === "reject" && !observation.trim()) { setError("Informe o motivo."); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/ponto/justificativas/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "approve" ? "rh_approve" : "rh_reject", observation }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Erro"); return; }
      setSelected(null); setAction(null); load();
    } finally { setSaving(false); }
  }

  async function handleBatch() {
    if (!batchAction || checked.size === 0) return;
    if (batchAction === "reject" && !batchObs.trim()) { setBatchError("Observação obrigatória."); return; }
    setBatchSaving(true);
    try {
      const r = await fetch("/api/ponto/justificativas/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checked), action: batchAction === "approve" ? "rh_approve" : "rh_reject", observation: batchObs }),
      });
      const d = await r.json();
      if (!r.ok) { setBatchError(d.error || "Erro"); return; }
      setBatchAction(null); setBatchObs(""); load();
    } finally { setBatchSaving(false); }
  }

  const allChecked = items.length > 0 && checked.size === items.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "Nenhuma aguardando." : `${items.length} aguardando aprovação do RH.`}
        </p>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground"
            onClick={() => setChecked(allChecked ? new Set() : new Set(items.map(i => i.id)))}>
            {allChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
            Selecionar todas
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 size={40} className="mx-auto mb-2 opacity-30" /><p>Tudo aprovado!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(j => (
            <Card key={j.id} className={checked.has(j.id) ? "ring-2 ring-blue-400" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Button variant="ghost" size="icon" className="mt-1 shrink-0 w-6 h-6 p-0"
                    onClick={() => toggleCheck(j.id)}>
                    {checked.has(j.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-400" />}
                  </Button>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{j.profiles?.full_name}</span>
                      <Badge variant="secondary" className="text-xs">{j.profiles?.sector}</Badge>
                      <Badge className="text-xs bg-blue-50 text-blue-700 border-0">{j.justification_types?.name}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ocorrência: <strong className="text-foreground">{fmt(j.occurrence_date)}</strong>
                      {!j.is_full_day && j.start_time && ` · ${j.start_time}–${j.end_time}`}
                    </p>
                    <p className="text-sm border bg-gray-50 p-2 rounded-lg">{j.description}</p>
                    {j.manager_observation && (
                      <p className="text-xs bg-green-50 text-green-800 p-2 rounded-lg">
                        Gestor: {j.manager_observation}
                      </p>
                    )}
                    {j.document_url && (
                      <a href={`/api/ponto/justificativas/${j.id}/comprovante`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <Paperclip size={12} /> Ver comprovante
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-200"
                      onClick={() => { setSelected(j); setAction("approve"); setObservation(""); setError(""); }}>
                      <CheckCircle2 size={14} /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200"
                      onClick={() => { setSelected(j); setAction("reject"); setObservation(""); setError(""); }}>
                      <XCircle size={14} /> Recusar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground"
                      onClick={() => openHistory(j)} disabled={loadingHistory}>
                      <History size={14} /> Histórico
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Barra de lote */}
      {checked.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-gray-900 text-white rounded-xl px-4 sm:px-5 py-3 shadow-2xl max-w-[calc(100vw-1.5rem)]">
          <span className="text-sm font-medium">{checked.size} selecionada(s)</span>
          <div className="hidden sm:block w-px h-5 bg-gray-600" />
          <Button size="sm" className="bg-green-600 hover:bg-green-700"
            onClick={() => { setBatchAction("approve"); setBatchObs(""); setBatchError(""); }}>
            <CheckCircle2 size={14} /> Aprovar em lote
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700"
            onClick={() => { setBatchAction("reject"); setBatchObs(""); setBatchError(""); }}>
            <XCircle size={14} /> Recusar em lote
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white w-6 h-6 p-0" onClick={() => setChecked(new Set())}>✕</Button>
        </div>
      )}

      {/* Dialog individual */}
      <Dialog open={!!selected && !!action} onOpenChange={() => { setSelected(null); setAction(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action === "approve" ? "Aprovar (RH)" : "Recusar (RH)"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {selected && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p><strong>{selected.profiles?.full_name}</strong> — {selected.justification_types?.name}</p>
                <p className="text-muted-foreground">{fmt(selected.occurrence_date)}</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Observação {action === "reject" && <span className="text-red-500">*</span>}</Label>
              <Textarea value={observation} onChange={e => setObservation(e.target.value)}
                placeholder={action === "approve" ? "Observação opcional" : "Motivo da recusa (obrigatório)"} rows={3} />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); }}>Cancelar</Button>
            <Button onClick={handleAction} disabled={saving} className={action === "reject" ? "bg-red-600 hover:bg-red-700" : ""}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : action === "approve" ? "Aprovar" : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog lote */}
      <Dialog open={!!batchAction} onOpenChange={v => { if (!v) setBatchAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{batchAction === "approve" ? `Aprovar ${checked.size} em lote` : `Recusar ${checked.size} em lote`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Observação {batchAction === "reject" && <span className="text-red-500">*</span>}</Label>
              <Textarea value={batchObs} onChange={e => setBatchObs(e.target.value)}
                placeholder={batchAction === "approve" ? "Opcional" : "Motivo (obrigatório)"} rows={3} />
            </div>
            {batchError && <p className="text-sm text-red-700">{batchError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAction(null)}>Cancelar</Button>
            <Button onClick={handleBatch} disabled={batchSaving} className={batchAction === "reject" ? "bg-red-600 hover:bg-red-700" : ""}>
              {batchSaving ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog histórico */}
      <Dialog open={!!historyModal} onOpenChange={v => { if (!v) setHistoryModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} /> Histórico
            </DialogTitle>
          </DialogHeader>
          {historyModal && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                {historyModal.item.profiles?.full_name} — {historyModal.item.justification_types?.name} — {fmt(historyModal.item.occurrence_date)}
              </p>
              {historyModal.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros.</p>
              ) : (
                <div className="space-y-2">
                  {historyModal.entries.map(h => {
                    const cfg = ACTION_LABELS[h.action];
                    return (
                      <div key={h.id} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                          <span className="w-px flex-1 bg-gray-200 mt-1" />
                        </div>
                        <div className="pb-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${cfg?.color ?? "text-gray-700"}`}>{cfg?.label ?? h.action}</span>
                            <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">por {h.actor_name}</p>
                          {h.observation && <p className="mt-1 text-xs bg-gray-50 border rounded p-2">{h.observation}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: TIPOS DE JUSTIFICATIVA
// ─────────────────────────────────────────────
function TiposTab() {
  const [types, setTypes] = useState<JType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<JType | null>(null);
  const [form, setForm] = useState({ name: "", description: "", requires_document: false, allows_partial_day: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/ponto/tipos"); const d = await r.json(); setTypes(d.types || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditItem(null); setForm({ name: "", description: "", requires_document: false, allows_partial_day: true }); setDialogOpen(true); }
  function openEdit(t: JType) { setEditItem(t); setForm({ name: t.name, description: t.description || "", requires_document: t.requires_document, allows_partial_day: t.allows_partial_day }); setDialogOpen(true); }

  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        await fetch(`/api/ponto/tipos/${editItem.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      } else {
        await fetch("/api/ponto/tipos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }
      setDialogOpen(false); load();
    } finally { setSaving(false); }
  }

  async function toggleActive(t: JType) {
    await fetch(`/api/ponto/tipos/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !t.active }) });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{types.length} tipo(s) cadastrado(s)</p>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo Tipo</Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead className="hidden md:table-cell">Req. Documento</TableHead>
                <TableHead className="hidden md:table-cell">Horário Parcial</TableHead><TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map(t => (
                <TableRow key={t.id} className={!t.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.requires_document ? "Sim" : "Não"}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.allows_partial_day ? "Sim" : "Não"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={t.active ? "success" : "secondary"} className="text-xs">
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(t)} className={t.active ? "text-red-500" : "text-green-500"}>
                        {t.active ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Editar Tipo" : "Novo Tipo de Justificativa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Consulta Médica" /></div>
            <div className="space-y-1"><Label>Descrição</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Opcional" /></div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="req_doc" checked={form.requires_document}
                  onCheckedChange={v => setForm({ ...form, requires_document: v === true })} />
                <Label htmlFor="req_doc" className="cursor-pointer">Exige comprovante</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="partial_day" checked={form.allows_partial_day}
                  onCheckedChange={v => setForm({ ...form, allows_partial_day: v === true })} />
                <Label htmlFor="partial_day" className="cursor-pointer">Permite horário específico</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: BANCO DE HORAS
// ─────────────────────────────────────────────
function BancoHorasTab() {
  const [records, setRecords] = useState<HourRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", reference_month: "", hours: "0", minutes: "0", description: "" });
  const [saving, setSaving] = useState(false);
  const [isNegative, setIsNegative] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/ponto/banco-horas"); const d = await r.json(); setRecords(d.records || []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadRecords();
    fetch("/api/admin/users?list=true").then(r => r.json()).then(d => setProfiles(d.users || [])).catch(() => {});
  }, [loadRecords]);

  async function handleSave() {
    setSaving(true);
    const totalMin = (parseInt(form.hours) * 60 + parseInt(form.minutes)) * (isNegative ? -1 : 1);
    try {
      await fetch("/api/ponto/banco-horas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: form.user_id, reference_month: form.reference_month + "-01", overtime_minutes: totalMin, description: form.description || null }),
      });
      setDialogOpen(false); loadRecords();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Saldos mensais de banco de horas</p>
        <Button size="sm" onClick={() => { setForm({ user_id: "", reference_month: new Date().toISOString().slice(0, 7), hours: "0", minutes: "0", description: "" }); setIsNegative(false); setDialogOpen(true); }}>
          <Plus size={14} /> Lançar Saldo
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Colaborador</TableHead><TableHead className="hidden md:table-cell">Setor</TableHead><TableHead>Mês</TableHead><TableHead>Saldo</TableHead><TableHead className="hidden lg:table-cell">Observação</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => {
                const isPos = r.overtime_minutes >= 0;
                const month = new Date(r.reference_month + "T00:00:00").toLocaleString("pt-BR", { month: "long", year: "numeric" });
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.profiles?.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.profiles?.sector}</TableCell>
                    <TableCell className="capitalize text-sm">{month}</TableCell>
                    <TableCell>
                      <span className={`font-bold text-sm flex items-center gap-1 ${isPos ? "text-green-700" : "text-red-700"}`}>
                        {isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isPos ? "+" : "-"}{minutesToHHMM(r.overtime_minutes)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {records.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lançamento ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançar Saldo de Banco de Horas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Colaborador *</Label>
              <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} — {p.sector}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Mês de Referência *</Label><Input type="month" value={form.reference_month} onChange={e => setForm({ ...form, reference_month: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Saldo</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={!isNegative ? "default" : "outline"}
                  className={!isNegative ? "bg-green-600 hover:bg-green-700 border-green-600" : "text-green-700 border-green-200"}
                  onClick={() => setIsNegative(false)}>
                  <TrendingUp size={14} /> + Crédito
                </Button>
                <Button type="button" size="sm" variant={isNegative ? "default" : "outline"}
                  className={isNegative ? "bg-red-600 hover:bg-red-700 border-red-600" : "text-red-700 border-red-200"}
                  onClick={() => setIsNegative(true)}>
                  <TrendingDown size={14} /> - Débito
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Input type="number" min="0" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="w-24" /><span className="text-sm text-muted-foreground">h</span>
                <Input type="number" min="0" max="59" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} className="w-24" /><span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
            <div className="space-y-1"><Label>Observação</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Horas extras do projeto X" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.user_id || !form.reference_month}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: FECHAMENTOS MENSAIS
// ─────────────────────────────────────────────
function FechamentosTab() {
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference_month: new Date().toISOString().slice(0, 7), notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/ponto/fechamentos"); const d = await r.json(); setFechamentos(d.fechamentos || []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClose() {
    if (!form.reference_month) return;
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/ponto/fechamentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_month: form.reference_month, notes: form.notes }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Erro"); return; }
      setDialogOpen(false); load();
    } finally { setSaving(false); }
  }

  async function handleReopen(id: string, month: string) {
    if (!confirm(`Reabrir o período ${month}? Colaboradores poderão criar justificativas novamente.`)) return;
    await fetch(`/api/ponto/fechamentos/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Controle quais meses estão abertos para justificativas</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ reference_month: new Date().toISOString().slice(0, 7), notes: "" }); setError(""); setDialogOpen(true); }}>
          <Lock size={14} /> Fechar Período
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : fechamentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-white">
          <Unlock size={36} className="mx-auto mb-2 opacity-30" />
          <p>Nenhum período fechado. Todos os meses estão abertos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Período</TableHead><TableHead className="hidden md:table-cell">Fechado por</TableHead><TableHead className="hidden lg:table-cell">Data do Fechamento</TableHead><TableHead className="hidden lg:table-cell">Observação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {fechamentos.map(f => (
                <TableRow key={f.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <Lock size={14} className="text-red-500" />
                      {new Date(f.reference_month + "-01T00:00:00").toLocaleString("pt-BR", { month: "long", year: "numeric" })}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{f.closed_by_name}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{new Date(f.closed_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{f.notes || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                      onClick={() => handleReopen(f.id, f.reference_month)}>
                      <Unlock size={14} /> Reabrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock size={18} /> Fechar Período</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              Após fechar, nenhum colaborador poderá criar justificativas para este mês. Apenas admin/TI pode reabrir.
            </div>
            <div className="space-y-1">
              <Label>Mês de Referência *</Label>
              <Input type="month" value={form.reference_month} onChange={e => setForm({ ...form, reference_month: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Folha de junho processada" />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleClose} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <><Lock size={14} /> Fechar Período</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB: RELATÓRIOS
// ─────────────────────────────────────────────
// TAB: FERIADOS
// ─────────────────────────────────────────────
interface Feriado { id: string; date: string; name: string; type: string }
const TIPO_LABELS: Record<string, string> = {
  nacional: "Nacional", estadual: "Estadual", municipal: "Municipal", hospital: "Hospital",
};
const TIPO_COLORS: Record<string, string> = {
  nacional: "bg-blue-100 text-blue-700",
  estadual: "bg-purple-100 text-purple-700",
  municipal: "bg-green-100 text-green-700",
  hospital: "bg-rose-100 text-rose-700",
};

function FeriadosTab() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [items, setItems] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", name: "", type: "nacional" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ponto/feriados?year=${year}`);
      const d = await r.json();
      setItems(d.feriados || []);
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form.date || !form.name.trim()) { setError("Data e nome são obrigatórios"); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/ponto/feriados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Erro ao salvar"); setSaving(false); return; }
    setShowForm(false); setForm({ date: "", name: "", type: "nacional" }); load();
    setSaving(false);
  }

  async function remove(id: string) {
    setDeleting(id);
    await fetch(`/api/ponto/feriados/${id}`, { method: "DELETE" });
    setDeleting(null); load();
  }

  const years = [String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Ano:</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> Adicionar feriado
        </Button>
      </div>

      {showForm && (
        <Card><CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Feriado Municipal" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhum feriado cadastrado para {year}.</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Data</TableHead><TableHead>Feriado</TableHead><TableHead>Tipo</TableHead><TableHead className="w-16"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {items.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="text-sm font-medium">{fmt(f.date)}</TableCell>
                  <TableCell className="text-sm">{f.name}</TableCell>
                  <TableCell><Badge className={`text-xs border-0 ${TIPO_COLORS[f.type] ?? "bg-gray-100 text-gray-700"}`}>{TIPO_LABELS[f.type] ?? f.type}</Badge></TableCell>
                  <TableCell>
                    <button onClick={() => remove(f.id)} disabled={deleting === f.id} className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                      {deleting === f.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
function RelatoriosTab() {
  const [filters, setFilters] = useState({ status: "all", from: "", to: "", search: "" });
  const [items, setItems] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(false);

  async function doSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: "all" });
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const r = await fetch(`/api/ponto/justificativas?${params}`);
      const d = await r.json();
      let result = d.justifications || [];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter((j: Justification) =>
          j.profiles?.full_name?.toLowerCase().includes(q) || j.justification_types?.name?.toLowerCase().includes(q)
        );
      }
      setItems(result);
    } finally { setLoading(false); }
  }

  function exportCSV() {
    const header = ["Nome","Setor","Tipo","Data Ocorrência","Status","Obs. Gestor","Obs. RH","Enviada em"];
    const rows = items.map(j => [
      j.profiles?.full_name || "", j.profiles?.sector || "", j.justification_types?.name || "",
      fmt(j.occurrence_date), j.status, j.manager_observation || "", j.rh_observation || "", fmt(j.created_at),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `justificativas_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const statusLabel: Record<string, string> = {
    pending: "Ag. Gestor", manager_approved: "Ag. RH", manager_rejected: "Recusada (Gestor)", approved: "Aprovada", rejected: "Recusada (RH)",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Ag. Gestor</SelectItem>
              <SelectItem value="manager_approved">Ag. RH</SelectItem>
              <SelectItem value="manager_rejected">Recusada (Gestor)</SelectItem>
              <SelectItem value="approved">Aprovada</SelectItem>
              <SelectItem value="rejected">Recusada (RH)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Buscar</Label><Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Nome ou tipo..." /></div>
      </div>
      <div className="flex gap-3">
        <Button onClick={doSearch} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><Search size={14} /> Buscar</>}
        </Button>
        {items.length > 0 && (
          <Button variant="outline" onClick={exportCSV}><Download size={14} /> Exportar CSV ({items.length})</Button>
        )}
      </div>
      {items.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Colaborador</TableHead><TableHead className="hidden sm:table-cell">Tipo</TableHead><TableHead className="hidden md:table-cell">Ocorrência</TableHead><TableHead>Status</TableHead><TableHead className="hidden lg:table-cell">Enviada</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {items.map(j => (
                <TableRow key={j.id}>
                  <TableCell><p className="font-medium text-sm">{j.profiles?.full_name}</p><p className="text-xs text-muted-foreground">{j.profiles?.sector}</p></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{j.justification_types?.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{fmt(j.occurrence_date)}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border-0 ${j.status === "approved" ? "bg-green-100 text-green-800" : j.status.includes("rejected") ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {statusLabel[j.status] || j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{fmt(j.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE PRINCIPAL
// ─────────────────────────────────────────────
export default function AdminPontoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">Ponto — RH</h2>
        <p className="text-muted-foreground">Aprovações, fechamentos, banco de horas e relatórios</p>
      </div>
      <Tabs defaultValue="aprovacoes">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto max-w-3xl">
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
          <TabsTrigger value="fechamentos">Fechamentos</TabsTrigger>
          <TabsTrigger value="tipos">Tipos</TabsTrigger>
          <TabsTrigger value="banco">Banco de Horas</TabsTrigger>
          <TabsTrigger value="feriados">Feriados</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
        <TabsContent value="aprovacoes" className="mt-6"><Suspense><ApprovacoesRH /></Suspense></TabsContent>
        <TabsContent value="fechamentos" className="mt-6"><Suspense><FechamentosTab /></Suspense></TabsContent>
        <TabsContent value="tipos" className="mt-6"><Suspense><TiposTab /></Suspense></TabsContent>
        <TabsContent value="banco" className="mt-6"><Suspense><BancoHorasTab /></Suspense></TabsContent>
        <TabsContent value="feriados" className="mt-6"><Suspense><FeriadosTab /></Suspense></TabsContent>
        <TabsContent value="relatorios" className="mt-6"><Suspense><RelatoriosTab /></Suspense></TabsContent>
      </Tabs>
    </div>
  );
}
