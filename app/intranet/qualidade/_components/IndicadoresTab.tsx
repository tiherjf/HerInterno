"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart2, Plus, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface IndicatorRecord { indicator_id: string; reference_month: string; actual_value: number; observations: string | null }
interface Indicator {
  id: string; name: string; description: string | null; formula: string | null;
  unit: string; frequency: string; target_value: number | null; min_value: number | null;
  sector: string | null; category: string | null; active: boolean;
  responsible: { full_name: string } | null;
  records: IndicatorRecord[];
}

function trafficLight(ind: Indicator): "green" | "yellow" | "red" | "gray" {
  const last = ind.records[ind.records.length - 1];
  if (!last || ind.target_value === null) return "gray";
  if (last.actual_value >= ind.target_value) return "green";
  if (ind.min_value !== null && last.actual_value >= ind.min_value) return "yellow";
  return "red";
}
const LIGHT_DOT: Record<string, string> = { green:"bg-green-500", yellow:"bg-yellow-400", red:"bg-red-500", gray:"bg-gray-300" };
const LIGHT_BORDER: Record<string, string> = { green:"border-green-200", yellow:"border-yellow-200", red:"border-red-200", gray:"border-gray-200" };

function fmt(d: string) {
  const date = new Date(d.length === 7 ? d + "-01" : d + (d.includes("T") ? "" : "T00:00:00"));
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function IndicadoresTab({ sector, isAdmin, setores }: Props) {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Indicator | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [form, setForm] = useState({
    name: "", description: "", formula: "", unit: "%", frequency: "mensal",
    target_value: "", min_value: "", sector: sector ?? "", category: "",
  });
  const [recordForm, setRecordForm] = useState({ reference_month: "", actual_value: "", observations: "" });
  const [recordSaving, setRecordSaving] = useState(false);

  useEffect(() => { setForm(f => ({ ...f, sector: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      const r = await fetch(`/api/qualidade/indicadores?${params}`);
      const d = await r.json();
      setIndicators(d.indicators || []);
    } finally { setLoading(false); }
  }, [sector]);

  useEffect(() => { load(); }, [load]);

  const categories = Array.from(new Set(indicators.map(i => i.category).filter(Boolean))) as string[];

  const filtered = filterCategory
    ? indicators.filter(i => i.category === filterCategory)
    : indicators;

  async function createIndicator() {
    if (!form.name.trim()) { setFormError("Nome é obrigatório"); return; }
    setSaving(true); setFormError("");
    const r = await fetch("/api/qualidade/indicadores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        target_value: form.target_value !== "" ? Number(form.target_value) : null,
        min_value: form.min_value !== "" ? Number(form.min_value) : null,
      }),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowForm(false);
    setForm({ name:"",description:"",formula:"",unit:"%",frequency:"mensal",target_value:"",min_value:"",sector:sector??"",category:"" });
    load(); setSaving(false);
  }

  async function addRecord(ind: Indicator) {
    if (!recordForm.reference_month || recordForm.actual_value === "") return;
    setRecordSaving(true);
    await fetch(`/api/qualidade/indicadores/${ind.id}/records`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_month: recordForm.reference_month,
        actual_value: Number(recordForm.actual_value),
        observations: recordForm.observations || null,
      }),
    });
    setRecordForm({ reference_month:"", actual_value:"", observations:"" });
    await load();
    // refresh selected
    const r = await fetch("/api/qualidade/indicadores");
    const d = await r.json();
    const updated = (d.indicators || []).find((i: Indicator) => i.id === ind.id);
    if (updated) setSelected(updated);
    setRecordSaving(false);
  }

  function trendIcon(records: IndicatorRecord[]) {
    if (records.length < 2) return <Minus size={13} className="text-gray-400" />;
    const diff = records[records.length - 1].actual_value - records[records.length - 2].actual_value;
    if (diff > 0) return <TrendingUp size={13} className="text-green-500" />;
    if (diff < 0) return <TrendingDown size={13} className="text-red-500" />;
    return <Minus size={13} className="text-gray-400" />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2">
          {categories.length > 0 && (
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Categoria..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as categorias</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {isAdmin && <Button onClick={() => setShowForm(true)}><Plus size={14} /> Novo Indicador</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><BarChart2 size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhum indicador{sector ? ` para ${sector}` : ""} cadastrado.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ind => {
            const light = trafficLight(ind);
            const last = ind.records[ind.records.length - 1];
            return (
              <button key={ind.id} onClick={() => setSelected(ind)}
                className={`text-left rounded-xl border p-4 hover:shadow-md transition-all bg-white ${LIGHT_BORDER[light]}`}>
                <div className="flex items-start gap-2.5 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${LIGHT_DOT[light]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{ind.name}</p>
                    <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                      {ind.sector && <span>{ind.sector}</span>}
                      {ind.category && <span>· {ind.category}</span>}
                    </div>
                  </div>
                  {trendIcon(ind.records)}
                </div>

                {last ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">{last.actual_value}</span>
                    <span className="text-sm text-muted-foreground">{ind.unit}</span>
                    {ind.target_value !== null && (
                      <span className="text-xs text-muted-foreground ml-1">/ {ind.target_value}{ind.unit}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem lançamentos</p>
                )}

                {ind.records.length > 1 && (
                  <div className="mt-3 flex items-end gap-0.5 h-7">
                    {ind.records.slice(-6).map((r, i) => {
                      const maxVal = Math.max(...ind.records.slice(-6).map(x => x.actual_value), ind.target_value ?? 0, 1);
                      const h = Math.max(3, Math.round((r.actual_value / maxVal) * 28));
                      const atTarget = ind.target_value !== null && r.actual_value >= ind.target_value;
                      const aboveMin = ind.min_value !== null && r.actual_value >= ind.min_value;
                      const color = atTarget ? "bg-green-400" : aboveMin ? "bg-yellow-400" : "bg-red-400";
                      return <div key={i} style={{ height: h }} className={`flex-1 rounded-t ${color} opacity-70`} />;
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{ind.frequency} · {ind.records.length} lançamento{ind.records.length !== 1 ? "s" : ""}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo Indicador</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Nome *</Label><Input value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Unidade</Label><Input value={form.unit} onChange={e => setForm({...form,unit:e.target.value})} placeholder="%, un, dias..." /></div>
              <div><Label className="text-xs">Frequência</Label>
                <Select value={form.frequency} onValueChange={v => setForm({...form,frequency:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Meta (alvo)</Label><Input type="number" value={form.target_value} onChange={e => setForm({...form,target_value:e.target.value})} /></div>
              <div><Label className="text-xs">Mínimo aceitável</Label><Input type="number" value={form.min_value} onChange={e => setForm({...form,min_value:e.target.value})} /></div>
              <div><Label className="text-xs">Setor</Label>
                {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                  <Select value={form.sector} onValueChange={v => setForm({...form,sector:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem setor</SelectItem>
                      {setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div><Label className="text-xs">Categoria</Label><Input value={form.category} onChange={e => setForm({...form,category:e.target.value})} placeholder="Qualidade, Segurança..." /></div>
            </div>
            <div><Label className="text-xs">Fórmula de cálculo</Label><Input value={form.formula} onChange={e => setForm({...form,formula:e.target.value})} placeholder="(eventos / total) × 100" /></div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createIndicator} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{selected.sector}{selected.category ? ` · ${selected.category}` : ""}</p>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Unidade</p><p className="font-medium">{selected.unit}</p></div>
                  <div><p className="text-xs text-muted-foreground">Meta</p><p className="font-medium">{selected.target_value ?? "—"} {selected.unit}</p></div>
                  <div><p className="text-xs text-muted-foreground">Mínimo</p><p className="font-medium">{selected.min_value ?? "—"} {selected.unit}</p></div>
                </div>
                {selected.formula && <div><p className="text-xs text-muted-foreground mb-1">Fórmula</p><p className="text-sm font-mono bg-gray-50 rounded px-3 py-2">{selected.formula}</p></div>}

                {/* Records table */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico</p>
                  {selected.records.length === 0 ? <p className="text-sm text-muted-foreground">Sem lançamentos ainda.</p> : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50"><tr>
                          <th className="py-2 px-3 text-left text-xs text-muted-foreground font-medium">Mês</th>
                          <th className="py-2 px-3 text-left text-xs text-muted-foreground font-medium">Valor</th>
                          <th className="py-2 px-3 text-left text-xs text-muted-foreground font-medium">Status</th>
                        </tr></thead>
                        <tbody>
                          {[...selected.records].reverse().map((r, i) => {
                            const atTarget = selected.target_value !== null && r.actual_value >= selected.target_value;
                            const aboveMin = selected.min_value !== null && r.actual_value >= selected.min_value;
                            return (
                              <tr key={i} className="border-t">
                                <td className="py-2 px-3">{fmt(r.reference_month)}</td>
                                <td className={`py-2 px-3 font-semibold ${atTarget ? "text-green-600" : aboveMin ? "text-yellow-600" : "text-red-600"}`}>
                                  {r.actual_value} {selected.unit}
                                </td>
                                <td className="py-2 px-3 text-xs text-muted-foreground">
                                  {atTarget ? "✅ Meta atingida" : aboveMin ? "⚠️ Abaixo da meta" : "❌ Crítico"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Add record */}
                {isAdmin && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Lançar resultado</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Mês</Label><Input type="month" value={recordForm.reference_month} onChange={e => setRecordForm({...recordForm,reference_month:e.target.value})} /></div>
                      <div><Label className="text-xs">Valor ({selected.unit})</Label><Input type="number" value={recordForm.actual_value} onChange={e => setRecordForm({...recordForm,actual_value:e.target.value})} /></div>
                      <div><Label className="text-xs">Observações</Label><Input value={recordForm.observations} onChange={e => setRecordForm({...recordForm,observations:e.target.value})} /></div>
                    </div>
                    <Button className="mt-3" size="sm" onClick={() => addRecord(selected)} disabled={recordSaving}>
                      {recordSaving ? <Loader2 size={12} className="animate-spin" /> : "Lançar"}
                    </Button>
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
