"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, Plus, Loader2, ChevronRight } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Risk {
  id: string; title: string; description: string | null; sector: string | null;
  category: string; probability: number; impact: number; risk_score: number;
  status: string; mitigation_plan: string | null; residual_risk: string | null;
  owner: { full_name: string } | null; created_at: string;
}

const PROB_LABELS = ["","Raro","Improvável","Possível","Provável","Quase Certo"];
const IMPACT_LABELS = ["","Insignificante","Menor","Moderado","Maior","Catastrófico"];

const CATEGORY_LABELS: Record<string,string> = {
  operacional:"Operacional", estrategico:"Estratégico", financeiro:"Financeiro",
  compliance:"Compliance", seguranca:"Segurança",
};

const STATUS_META: Record<string,{label:string;color:string}> = {
  identificado:   { label:"Identificado",   color:"bg-gray-100 text-gray-700" },
  em_tratamento:  { label:"Em tratamento",  color:"bg-yellow-100 text-yellow-700" },
  mitigado:       { label:"Mitigado",       color:"bg-green-100 text-green-700" },
  aceito:         { label:"Aceito",         color:"bg-blue-100 text-blue-700" },
};

function riskLevel(score: number): { label: string; bg: string; text: string; border: string } {
  if (score >= 17) return { label:"Crítico",  bg:"bg-red-500",    text:"text-white",    border:"border-red-300" };
  if (score >= 10) return { label:"Alto",     bg:"bg-orange-400", text:"text-white",    border:"border-orange-300" };
  if (score >= 5)  return { label:"Médio",    bg:"bg-yellow-400", text:"text-gray-800", border:"border-yellow-300" };
  return              { label:"Baixo",    bg:"bg-green-400",  text:"text-white",    border:"border-green-300" };
}

// 5×5 Risk Matrix visual
function RiskMatrix({ risks }: { risks: Risk[] }) {
  const probLabels = ["Q. Certo","Provável","Possível","Improvável","Raro"];
  const impLabels  = ["Insig.","Menor","Moderado","Maior","Catast."];

  function cellColor(p: number, i: number) {
    const s = p * i;
    if (s >= 17) return "bg-red-200";
    if (s >= 10) return "bg-orange-200";
    if (s >= 5)  return "bg-yellow-100";
    return "bg-green-100";
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <p className="text-xs text-center text-muted-foreground mb-1 font-medium">Matriz de Riscos — Probabilidade × Impacto</p>
        <div className="flex">
          {/* Y axis label */}
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground" style={{ writingMode:"vertical-rl", transform:"rotate(180deg)", whiteSpace:"nowrap" }}>Probabilidade</span>
          </div>
          <div>
            {/* Matrix grid */}
            {[5,4,3,2,1].map(p => (
              <div key={p} className="flex items-center">
                <span className="text-xs text-muted-foreground w-20 text-right pr-2">{probLabels[5-p]}</span>
                {[1,2,3,4,5].map(i => {
                  const inCell = risks.filter(r => r.probability === p && r.impact === i);
                  return (
                    <div key={i} className={`w-14 h-12 border border-white/50 ${cellColor(p,i)} flex flex-col items-center justify-center gap-0.5 relative`}>
                      {inCell.map((r,idx) => (
                        <div key={idx} title={r.title}
                          className={`w-5 h-5 rounded-full ${riskLevel(r.risk_score).bg} border-2 border-white flex items-center justify-center`}>
                          <span className="text-white text-xs font-bold">{idx+1}</span>
                        </div>
                      ))}
                      {inCell.length === 0 && <span className="text-xs text-gray-300 font-bold">{p*i}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* X axis labels */}
            <div className="flex">
              <span className="w-20" />
              {impLabels.map((l,i) => <span key={i} className="w-14 text-center text-xs text-muted-foreground">{l}</span>)}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">Impacto</p>
          </div>
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {[{l:"Baixo (1-4)",bg:"bg-green-400"},{l:"Médio (5-9)",bg:"bg-yellow-400"},{l:"Alto (10-16)",bg:"bg-orange-400"},{l:"Crítico (17-25)",bg:"bg-red-500"}].map(({l,bg}) => (
            <div key={l} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded ${bg}`} /><span className="text-xs text-muted-foreground">{l}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RiscosTab({ sector, isAdmin, setores }: Props) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Risk | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [view, setView] = useState<"list"|"matrix">("list");

  const [form, setForm] = useState({
    title:"", description:"", sector: sector ?? "", category:"operacional",
    probability:"3", impact:"3", mitigation_plan:"", status:"identificado",
  });

  useEffect(() => { setForm(f => ({ ...f, sector: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      const r = await fetch(`/api/qualidade/riscos?${params}`);
      const d = await r.json();
      setRisks(d.risks || []);
    } finally { setLoading(false); }
  }, [sector, filterStatus, filterCategory]);

  useEffect(() => { load(); }, [load]);

  async function createRisk() {
    if (!form.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const r = await fetch("/api/qualidade/riscos", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, probability: Number(form.probability), impact: Number(form.impact) }),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:"",description:"",sector:sector??"",category:"operacional",probability:"3",impact:"3",mitigation_plan:"",status:"identificado" });
    load(); setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/qualidade/riscos/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status }),
    });
    load();
    if (selected?.id === id) setSelected(prev => prev ? {...prev, status} : null);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view==="list" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-gray-50"}`}>Lista</button>
            <button onClick={() => setView("matrix")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view==="matrix" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-gray-50"}`}>Matriz</button>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="Status..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {Object.entries(STATUS_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 bg-white"><SelectValue placeholder="Categoria..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && <Button onClick={() => setShowForm(true)}><Plus size={14} /> Novo Risco</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : view === "matrix" ? (
        <div className="bg-white border rounded-xl p-5">
          <RiskMatrix risks={risks} />
          {risks.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {risks.map((r,i) => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-5 h-5 rounded-full ${riskLevel(r.risk_score).bg} flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{i+1}</span>
                  </span>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-muted-foreground text-xs">{r.sector}</span>
                  <span className="text-xs text-muted-foreground ml-auto">P{r.probability}×I{r.impact}={r.risk_score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : risks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><ShieldAlert size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhum risco identificado{sector ? ` para ${sector}` : ""}.</p></div>
      ) : (
        <div className="space-y-2">
          {risks.map(risk => {
            const lvl = riskLevel(risk.risk_score);
            return (
              <button key={risk.id} onClick={() => setSelected(risk)}
                className={`w-full text-left bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all ${lvl.border}`}>
                <div className={`shrink-0 w-14 h-12 rounded-lg ${lvl.bg} ${lvl.text} flex flex-col items-center justify-center`}>
                  <span className="text-lg font-bold leading-tight">{risk.risk_score}</span>
                  <span className="text-xs opacity-80">{lvl.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{risk.title}</p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{CATEGORY_LABELS[risk.category]}</span>
                    {risk.sector && <span>· {risk.sector}</span>}
                    <span>· P{risk.probability} × I{risk.impact}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Badge className={`text-xs border-0 ${STATUS_META[risk.status]?.color}`}>{STATUS_META[risk.status]?.label}</Badge>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo Risco</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm({...form,category:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Setor</Label>
                {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                  <Select value={form.sector} onValueChange={v => setForm({...form,sector:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">Geral</SelectItem>{setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div><Label className="text-xs">Probabilidade (1=Raro … 5=Q.Certo)</Label>
                <Select value={form.probability} onValueChange={v => setForm({...form,probability:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} — {PROB_LABELS[n]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Impacto (1=Insig. … 5=Catast.)</Label>
                <Select value={form.impact} onValueChange={v => setForm({...form,impact:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} — {IMPACT_LABELS[n]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm font-medium text-center">
              Score: <span className={`font-bold ${riskLevel(Number(form.probability)*Number(form.impact)).bg.replace("bg-","text-").replace("-400","").replace("-500","")} text-lg`}>{Number(form.probability)*Number(form.impact)}</span>
              {" — "}{riskLevel(Number(form.probability)*Number(form.impact)).label}
            </div>
            <div><Label className="text-xs">Plano de mitigação</Label><Textarea rows={2} value={form.mitigation_plan} onChange={e => setForm({...form,mitigation_plan:e.target.value})} /></div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createRisk} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-16 h-14 rounded-xl ${riskLevel(selected.risk_score).bg} ${riskLevel(selected.risk_score).text} flex flex-col items-center justify-center`}>
                    <span className="text-2xl font-bold leading-tight">{selected.risk_score}</span>
                    <span className="text-xs opacity-80">{riskLevel(selected.risk_score).label}</span>
                  </div>
                  <div className="flex-1">
                    <DialogTitle>{selected.title}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{CATEGORY_LABELS[selected.category]}{selected.sector ? ` · ${selected.sector}` : ""}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Probabilidade</p><p className="font-medium">{selected.probability} — {PROB_LABELS[selected.probability]}</p></div>
                  <div><p className="text-xs text-muted-foreground">Impacto</p><p className="font-medium">{selected.impact} — {IMPACT_LABELS[selected.impact]}</p></div>
                  {selected.owner && <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{selected.owner.full_name}</p></div>}
                </div>
                {selected.description && <div><p className="text-xs text-muted-foreground mb-1">Descrição</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.description}</p></div>}
                {selected.mitigation_plan && <div><p className="text-xs text-muted-foreground mb-1">Plano de mitigação</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.mitigation_plan}</p></div>}
                {selected.residual_risk && <div><p className="text-xs text-muted-foreground mb-1">Risco residual</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.residual_risk}</p></div>}
                {isAdmin && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_META).map(([s,m]) => (
                        <button key={s} onClick={() => updateStatus(selected.id, s)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            selected.status === s ? `${m.color} border-current` : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                          }`}>{m.label}</button>
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
