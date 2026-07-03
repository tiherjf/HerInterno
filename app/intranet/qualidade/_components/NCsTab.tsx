"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Plus, Loader2, ChevronRight, CheckCircle2, Clock, User, MapPin, X, Check } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface NC {
  id: string; number: string; title: string; category: string; origin: string;
  sector: string | null; severity: string; status: string; occurrence_date: string | null;
  deadline: string | null; description: string | null; root_cause: string | null;
  immediate_action: string | null; effectiveness_check: string | null; conclusion: string | null;
  cinco_porques: string[] | null;
  created_at: string; responsible: { full_name: string } | null; creator: { full_name: string } | null;
}
interface ActionPlan {
  id: string; what: string; why: string; where_loc: string | null;
  when_date: string | null; how: string | null; how_much: string | null;
  status: string; who: { full_name: string } | null;
}
interface HistoryEntry { id: string; actor_name: string; action: string; note: string | null; created_at: string }

export const SEVERITY_META: Record<string, { label: string; color: string }> = {
  critica:    { label: "Crítica",     color: "bg-red-100 text-red-800 border-red-200" },
  maior:      { label: "Maior",      color: "bg-orange-100 text-orange-800 border-orange-200" },
  menor:      { label: "Menor",      color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  observacao: { label: "Observação", color: "bg-blue-100 text-blue-800 border-blue-200" },
};
export const STATUS_META: Record<string, { label: string; color: string }> = {
  aberta:         { label: "Aberta",          color: "bg-red-50 text-red-700 border-red-200" },
  em_analise:     { label: "Em análise",      color: "bg-orange-50 text-orange-700 border-orange-200" },
  plano_definido: { label: "Plano definido",  color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  em_execucao:    { label: "Em execução",     color: "bg-blue-50 text-blue-700 border-blue-200" },
  verificacao:    { label: "Verificação",     color: "bg-purple-50 text-purple-700 border-purple-200" },
  concluida:      { label: "Concluída",       color: "bg-green-50 text-green-700 border-green-200" },
  cancelada:      { label: "Cancelada",       color: "bg-gray-100 text-gray-600 border-gray-200" },
};
const CATEGORY_LABELS: Record<string, string> = {
  processo: "Processo", produto_servico: "Produto/Serviço", sistemica: "Sistêmica", seguranca: "Segurança",
};
const ORIGIN_LABELS: Record<string, string> = {
  auditoria_interna: "Auditoria Interna", auditoria_externa: "Auditoria Externa",
  reclamacao: "Reclamação", observacao: "Observação", indicador: "Indicador", visa: "VISA", outro: "Outro",
};
const STATUS_FLOW = ["aberta","em_analise","plano_definido","em_execucao","verificacao","concluida"];
function fmt(d: string) { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR"); }

export function NCsTab({ sector, setores }: Props) {
  const [ncs, setNcs] = useState<NC[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<{ nc: NC; plans: ActionPlan[]; history: HistoryEntry[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [planForm, setPlanForm] = useState({ what: "", why: "", where_loc: "", when_date: "", how: "", how_much: "" });
  const [addingPlan, setAddingPlan] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [cincoState, setCincoState] = useState<string[]>(["","","","",""]);
  const [cincoSaving, setCincoSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", category: "processo", origin: "observacao",
    sector: sector ?? "", severity: "menor", occurrence_date: "", deadline: "", immediate_action: "",
  });

  // Sync sector into form when pill changes
  useEffect(() => { setForm(f => ({ ...f, sector: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      const r = await fetch(`/api/qualidade/ncs?${params}`);
      const d = await r.json();
      setNcs(d.ncs || []);
    } finally { setLoading(false); }
  }, [sector, filterStatus, filterSeverity]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    const r = await fetch(`/api/qualidade/ncs/${id}`);
    const d = await r.json();
    setSelected({ nc: d.nc, plans: d.plans || [], history: d.history || [] });
    const saved = d.nc?.cinco_porques ?? [];
    setCincoState([saved[0]??"", saved[1]??"", saved[2]??"", saved[3]??"", saved[4]??""]);
  };

  async function saveCinco(ncId: string) {
    setCincoSaving(true);
    await fetch(`/api/qualidade/ncs/${ncId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cinco_porques: cincoState }),
    });
    setCincoSaving(false);
  }

  async function createNC() {
    if (!form.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const r = await fetch("/api/qualidade/ncs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro ao criar"); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:"",description:"",category:"processo",origin:"observacao",sector:sector??"",severity:"menor",occurrence_date:"",deadline:"",immediate_action:"" });
    load(); setSaving(false);
  }

  async function changeStatus(ncId: string, status: string) {
    await fetch(`/api/qualidade/ncs/${ncId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (selected) {
      const r = await fetch(`/api/qualidade/ncs/${ncId}`);
      const d = await r.json();
      setSelected({ nc: d.nc, plans: d.plans || [], history: d.history || [] });
    }
    load();
  }

  async function addPlan(ncId: string) {
    if (!planForm.what.trim() || !planForm.why.trim()) return;
    setPlanSaving(true);
    await fetch(`/api/qualidade/ncs/${ncId}/action-plans`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planForm),
    });
    setPlanForm({ what:"",why:"",where_loc:"",when_date:"",how:"",how_much:"" });
    setAddingPlan(false);
    const r = await fetch(`/api/qualidade/ncs/${ncId}`);
    const d = await r.json();
    setSelected({ nc: d.nc, plans: d.plans||[], history: d.history||[] });
    setPlanSaving(false);
  }

  async function togglePlan(ncId: string, planId: string, current: string) {
    const next = current === "concluida" ? "pendente" : current === "pendente" ? "em_andamento" : "concluida";
    await fetch(`/api/qualidade/ncs/${ncId}/action-plans`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId, status: next }),
    });
    const r = await fetch(`/api/qualidade/ncs/${ncId}`);
    const d = await r.json();
    setSelected({ nc: d.nc, plans: d.plans||[], history: d.history||[] });
  }

  const filtered = ncs.filter(nc =>
    !search || nc.title.toLowerCase().includes(search.toLowerCase()) ||
    nc.number.toLowerCase().includes(search.toLowerCase()) ||
    (nc.sector ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const sectorOptions = sector ? [{ name: sector }] : [{ name: "" }, ...setores.map(s => ({ name: s.name }))];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <Input className="w-52" placeholder="Buscar NC..." value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as gravidades</SelectItem>
              {Object.entries(SEVERITY_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={14} /> Nova NC</Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><AlertTriangle size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhuma NC encontrada.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(nc => (
            <button key={nc.id} onClick={() => openDetail(nc.id)}
              className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="shrink-0">
                <p className="text-xs font-mono text-muted-foreground">{nc.number}</p>
                <Badge className={`text-xs border mt-1 ${SEVERITY_META[nc.severity]?.color}`}>{SEVERITY_META[nc.severity]?.label}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{nc.title}</p>
                <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                  {nc.sector && <span className="flex items-center gap-1"><MapPin size={9} />{nc.sector}</span>}
                  <span>{ORIGIN_LABELS[nc.origin]}</span>
                  {nc.responsible && <span className="flex items-center gap-1"><User size={9} />{nc.responsible.full_name}</span>}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Badge className={`text-xs border ${STATUS_META[nc.status]?.color}`}>{STATUS_META[nc.status]?.label}</Badge>
                <ChevronRight size={15} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create NC dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Não-Conformidade</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm({...form,category:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Origem *</Label>
                <Select value={form.origin} onValueChange={v => setForm({...form,origin:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ORIGIN_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Gravidade *</Label>
                <Select value={form.severity} onValueChange={v => setForm({...form,severity:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SEVERITY_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Setor</Label>
                {sector ? (
                  <Input value={sector} disabled className="bg-gray-50" />
                ) : (
                  <Select value={form.sector} onValueChange={v => setForm({...form,sector:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem setor</SelectItem>
                      {setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div><Label className="text-xs">Data da ocorrência</Label><Input type="date" value={form.occurrence_date} onChange={e => setForm({...form,occurrence_date:e.target.value})} /></div>
              <div><Label className="text-xs">Prazo para resolução</Label><Input type="date" value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})} /></div>
            </div>
            <div><Label className="text-xs">Ação imediata tomada</Label><Textarea rows={2} value={form.immediate_action} onChange={e => setForm({...form,immediate_action:e.target.value})} /></div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createNC} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar NC"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{selected.nc.number}</p>
                    <DialogTitle className="text-lg mt-0.5">{selected.nc.title}</DialogTitle>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Badge className={`text-xs border ${SEVERITY_META[selected.nc.severity]?.color}`}>{SEVERITY_META[selected.nc.severity]?.label}</Badge>
                    <Badge className={`text-xs border ${STATUS_META[selected.nc.status]?.color}`}>{STATUS_META[selected.nc.status]?.label}</Badge>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Categoria</p><p className="font-medium">{CATEGORY_LABELS[selected.nc.category]}</p></div>
                  <div><p className="text-xs text-muted-foreground">Origem</p><p className="font-medium">{ORIGIN_LABELS[selected.nc.origin]}</p></div>
                  {selected.nc.sector && <div><p className="text-xs text-muted-foreground">Setor</p><p className="font-medium">{selected.nc.sector}</p></div>}
                  {selected.nc.occurrence_date && <div><p className="text-xs text-muted-foreground">Ocorrência</p><p className="font-medium">{fmt(selected.nc.occurrence_date)}</p></div>}
                  {selected.nc.deadline && <div><p className="text-xs text-muted-foreground">Prazo</p><p className="font-medium">{fmt(selected.nc.deadline)}</p></div>}
                  {selected.nc.responsible && <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{selected.nc.responsible.full_name}</p></div>}
                </div>
                {selected.nc.description && <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Descrição</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.nc.description}</p></div>}
                {selected.nc.root_cause && <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Causa Raiz</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.nc.root_cause}</p></div>}

                {/* 5 Porquês */}
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Análise — 5 Porquês</p>
                    <Button size="sm" variant="ghost" className="text-violet-700 hover:bg-violet-100 h-7 px-2 text-xs" onClick={() => saveCinco(selected.nc.id)} disabled={cincoSaving}>
                      {cincoSaving ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {cincoState.map((val, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-violet-200 text-violet-700 text-xs font-bold flex items-center justify-center">{i+1}</span>
                        <Input
                          value={val}
                          onChange={e => setCincoState(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                          placeholder={`Por quê ${i+1}?`}
                          className="bg-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-violet-500 mt-2">Pergunte &quot;por quê?&quot; repetidamente até encontrar a causa raiz real.</p>
                </div>

                {/* Status flow */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Avançar Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FLOW.map((s, i) => {
                      const current = STATUS_FLOW.indexOf(selected.nc.status);
                      const isDone = i <= current; const isNext = i === current + 1;
                      return (
                        <button key={s} onClick={() => isNext ? changeStatus(selected.nc.id, s) : undefined}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 border transition-all ${
                            isDone ? "bg-green-50 text-green-700 border-green-200" :
                            isNext ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 cursor-pointer" :
                            "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                          }`}>
                          {isDone && <Check size={11} />}{STATUS_META[s].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action plans */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano de Ação 5W2H</p>
                    <Button size="sm" variant="outline" onClick={() => setAddingPlan(v => !v)}><Plus size={12} /> Adicionar</Button>
                  </div>
                  {addingPlan && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">O quê? *</Label><Input value={planForm.what} onChange={e => setPlanForm({...planForm,what:e.target.value})} /></div>
                        <div><Label className="text-xs">Por quê? *</Label><Input value={planForm.why} onChange={e => setPlanForm({...planForm,why:e.target.value})} /></div>
                        <div><Label className="text-xs">Onde?</Label><Input value={planForm.where_loc} onChange={e => setPlanForm({...planForm,where_loc:e.target.value})} /></div>
                        <div><Label className="text-xs">Quando?</Label><Input type="date" value={planForm.when_date} onChange={e => setPlanForm({...planForm,when_date:e.target.value})} /></div>
                        <div><Label className="text-xs">Como?</Label><Input value={planForm.how} onChange={e => setPlanForm({...planForm,how:e.target.value})} /></div>
                        <div><Label className="text-xs">Quanto custa?</Label><Input value={planForm.how_much} onChange={e => setPlanForm({...planForm,how_much:e.target.value})} /></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addPlan(selected.nc.id)} disabled={planSaving}>{planSaving ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingPlan(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                  {selected.plans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Nenhum plano de ação.</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.plans.map(plan => (
                        <div key={plan.id} className="bg-white border rounded-lg p-3 flex items-start gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{plan.what}</p>
                            <p className="text-xs text-muted-foreground">{plan.why}</p>
                            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                              {plan.who && <span>Quem: {plan.who.full_name}</span>}
                              {plan.when_date && <span>Quando: {fmt(plan.when_date)}</span>}
                            </div>
                          </div>
                          <button onClick={() => togglePlan(selected.nc.id, plan.id, plan.status)}
                            className={`shrink-0 p-1.5 rounded-lg border text-xs transition-colors ${
                              plan.status === "concluida" ? "bg-green-100 text-green-700 border-green-200" :
                              plan.status === "em_andamento" ? "bg-blue-100 text-blue-700 border-blue-200" :
                              "bg-gray-100 text-gray-600 border-gray-200"
                            }`}>
                            {plan.status === "concluida" ? <CheckCircle2 size={14} /> : plan.status === "em_andamento" ? <Clock size={14} /> : <X size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* History */}
                {selected.history.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico</p>
                    <div className="space-y-1">
                      {selected.history.map(h => (
                        <div key={h.id} className="flex gap-3 text-sm">
                          <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{fmt(h.created_at)}</span>
                          <div><span className="font-medium">{h.actor_name}</span><span className="text-muted-foreground"> — {h.action}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
