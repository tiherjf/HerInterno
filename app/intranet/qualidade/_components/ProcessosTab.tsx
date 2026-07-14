"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Network, Plus, Loader2, ArrowRight, ChevronRight, X } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Process {
  id: string; name: string; description: string | null; sector: string | null;
  process_type: string; status: string; inputs: string[]; outputs: string[];
  suppliers: string[]; customers: string[]; risks: string[]; indicators: string[];
  owner: { full_name: string } | null;
}

const TYPE_META: Record<string,{label:string;color:string}> = {
  estrategico: { label:"Estratégico", color:"bg-purple-100 text-purple-700" },
  gerencial:   { label:"Gerencial",   color:"bg-blue-100 text-blue-700" },
  operacional: { label:"Operacional", color:"bg-green-100 text-green-700" },
  apoio:       { label:"Apoio",       color:"bg-gray-100 text-gray-600" },
};

const STATUS_COLORS: Record<string,string> = {
  ativo: "bg-green-100 text-green-700",
  em_revisao: "bg-yellow-100 text-yellow-700",
  obsoleto: "bg-red-100 text-red-600",
};

export function ProcessosTab({ sector, isAdmin, setores }: Props) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Process | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filterType, setFilterType] = useState("");

  const [form, setForm] = useState({
    name:"", description:"", sector: sector ?? "", process_type:"operacional", status:"ativo",
  });
  const [arrays, setArrays] = useState({
    inputs:[""], outputs:[""], suppliers:[""], customers:[""], risks:[""], indicators:[""],
  });

  useEffect(() => { setForm(f => ({ ...f, sector: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      if (filterType) params.set("type", filterType);
      const r = await fetch(`/api/qualidade/processos?${params}`);
      const d = await r.json();
      setProcesses(d.processes || []);
    } finally { setLoading(false); }
  }, [sector, filterType]);

  useEffect(() => { load(); }, [load]);

  function addItem(field: keyof typeof arrays) {
    setArrays(prev => ({ ...prev, [field]: [...prev[field], ""] }));
  }
  function removeItem(field: keyof typeof arrays, i: number) {
    setArrays(prev => ({ ...prev, [field]: prev[field].filter((_,j) => j !== i) }));
  }
  function updateItem(field: keyof typeof arrays, i: number, val: string) {
    setArrays(prev => {
      const arr = [...prev[field]];
      arr[i] = val;
      return { ...prev, [field]: arr };
    });
  }

  async function createProcess() {
    if (!form.name.trim()) { setFormError("Nome é obrigatório"); return; }
    setSaving(true); setFormError("");
    const clean = (arr: string[]) => arr.filter(s => s.trim());
    const r = await fetch("/api/qualidade/processos", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        ...form,
        inputs: clean(arrays.inputs), outputs: clean(arrays.outputs),
        suppliers: clean(arrays.suppliers), customers: clean(arrays.customers),
        risks: clean(arrays.risks), indicators: clean(arrays.indicators),
      }),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowForm(false);
    setForm({ name:"",description:"",sector:sector??"",process_type:"operacional",status:"ativo" });
    setArrays({ inputs:[""], outputs:[""], suppliers:[""], customers:[""], risks:[""], indicators:[""] });
    load(); setSaving(false);
  }

  // Group by type for overview display
  const grouped = Object.keys(TYPE_META).map(type => ({
    type, label: TYPE_META[type].label,
    procs: processes.filter(p => p.process_type === type && (!filterType || p.process_type === filterType)),
  })).filter(g => g.procs.length > 0);

  function ArrayField({ label, field, placeholder }: { label: string; field: keyof typeof arrays; placeholder: string }) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">{label}</Label>
          <button type="button" onClick={() => addItem(field)} className="text-xs text-primary hover:underline flex items-center gap-0.5"><Plus size={10} /> add</button>
        </div>
        <div className="space-y-1.5">
          {arrays[field].map((val, i) => (
            <div key={i} className="flex gap-1.5">
              <Input className="flex-1 text-sm" value={val} onChange={e => updateItem(field, i, e.target.value)} placeholder={placeholder} />
              {arrays[field].length > 1 && (
                <button type="button" onClick={() => removeItem(field, i)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Tipo de processo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            {Object.entries(TYPE_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && <Button onClick={() => setShowForm(true)}><Plus size={14} /> Novo Processo</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : processes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Network size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhum processo cadastrado{sector ? ` para ${sector}` : ""}.</p></div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, label, procs }) => (
            <div key={type}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Badge className={`${TYPE_META[type].color} text-xs border-0`}>{label}</Badge>
                <span className="text-gray-400">{procs.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {procs.map(proc => (
                  <button key={proc.id} onClick={() => setSelected(proc)}
                    className="text-left bg-white border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{proc.name}</p>
                        {proc.sector && <p className="text-xs text-muted-foreground mt-0.5">{proc.sector}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`text-xs border-0 ${STATUS_COLORS[proc.status]}`}>{proc.status === "ativo" ? "Ativo" : proc.status === "em_revisao" ? "Em revisão" : "Obsoleto"}</Badge>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                    {/* SIPOC mini preview */}
                    {(proc.inputs.length > 0 || proc.outputs.length > 0) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {proc.inputs.length > 0 && <span className="bg-gray-50 border rounded px-2 py-0.5">{proc.inputs.length} entrada{proc.inputs.length !== 1 ? "s" : ""}</span>}
                        {(proc.inputs.length > 0 || proc.outputs.length > 0) && <ArrowRight size={10} />}
                        <span className="bg-primary/5 border border-primary/20 rounded px-2 py-0.5 text-primary font-medium">{proc.name.slice(0,20)}</span>
                        {proc.outputs.length > 0 && <ArrowRight size={10} />}
                        {proc.outputs.length > 0 && <span className="bg-gray-50 border rounded px-2 py-0.5">{proc.outputs.length} saída{proc.outputs.length !== 1 ? "s" : ""}</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Processo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Tipo *</Label>
                <Select value={form.process_type} onValueChange={v => setForm({...form,process_type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
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
            </div>

            {/* SIPOC fields */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SIPOC — Entradas e Saídas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ArrayField label="Fornecedores" field="suppliers" placeholder="Quem fornece as entradas..." />
                <ArrayField label="Entradas" field="inputs" placeholder="Materiais, informações..." />
                <ArrayField label="Saídas" field="outputs" placeholder="Produtos, serviços..." />
                <ArrayField label="Clientes" field="customers" placeholder="Quem recebe as saídas..." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ArrayField label="Riscos associados" field="risks" placeholder="Risco identificado..." />
              <ArrayField label="Indicadores" field="indicators" placeholder="Nome do indicador..." />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createProcess} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <DialogTitle>{selected.name}</DialogTitle>
                    {selected.sector && <p className="text-sm text-muted-foreground">{selected.sector}</p>}
                  </div>
                  <Badge className={`text-xs border-0 shrink-0 ${TYPE_META[selected.process_type]?.color}`}>{TYPE_META[selected.process_type]?.label}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
                {selected.owner && <div><p className="text-xs text-muted-foreground">Responsável</p><p className="text-sm font-medium">{selected.owner.full_name}</p></div>}

                {/* SIPOC visual */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SIPOC</p>
                  <div className="flex items-start gap-2 overflow-x-auto pb-2">
                    {[
                      { label:"Fornecedores", items:selected.suppliers, color:"bg-gray-50 border-gray-200" },
                      { label:"Entradas",     items:selected.inputs,    color:"bg-blue-50 border-blue-200" },
                    ].map(({label,items,color}) => items.length > 0 ? (
                      <div key={label} className={`shrink-0 min-w-28 rounded-lg border p-2.5 ${color}`}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                        <ul className="space-y-1">{items.map((x,i) => <li key={i} className="text-xs">{x}</li>)}</ul>
                      </div>
                    ) : null)}
                    <div className="shrink-0 flex items-center"><ArrowRight size={16} className="text-muted-foreground mx-1" /></div>
                    <div className="shrink-0 min-w-32 rounded-lg border-2 border-primary bg-primary/5 p-2.5">
                      <p className="text-xs font-bold text-primary mb-1">Processo</p>
                      <p className="text-xs font-semibold">{selected.name}</p>
                    </div>
                    <div className="shrink-0 flex items-center"><ArrowRight size={16} className="text-muted-foreground mx-1" /></div>
                    {[
                      { label:"Saídas",   items:selected.outputs,   color:"bg-green-50 border-green-200" },
                      { label:"Clientes", items:selected.customers, color:"bg-gray-50 border-gray-200" },
                    ].map(({label,items,color}) => items.length > 0 ? (
                      <div key={label} className={`shrink-0 min-w-28 rounded-lg border p-2.5 ${color}`}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
                        <ul className="space-y-1">{items.map((x,i) => <li key={i} className="text-xs">{x}</li>)}</ul>
                      </div>
                    ) : null)}
                  </div>
                </div>

                {selected.risks.length > 0 && (
                  <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Riscos associados</p>
                    <div className="flex flex-wrap gap-1.5">{selected.risks.map((r,i) => <Badge key={i} className="bg-red-50 text-red-700 border-red-200 border text-xs">{r}</Badge>)}</div>
                  </div>
                )}
                {selected.indicators.length > 0 && (
                  <div><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Indicadores</p>
                    <div className="flex flex-wrap gap-1.5">{selected.indicators.map((ind,i) => <Badge key={i} className="bg-blue-50 text-blue-700 border-blue-200 border text-xs">{ind}</Badge>)}</div>
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
