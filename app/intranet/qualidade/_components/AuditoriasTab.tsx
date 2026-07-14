"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Plus, Loader2, AlertTriangle, MessageSquare, Lightbulb, ChevronRight } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Finding { id: string; finding_type: string; description: string; sector: string | null; nc: { number: string; title: string; status: string } | null }
interface Audit {
  id: string; title: string; audit_type: string; scope: string | null;
  audit_date: string | null; status: string; report: string | null;
  auditor: { full_name: string } | null; auditor_external: string | null;
  creator: { full_name: string } | null; created_at: string;
}

const STATUS_META: Record<string,{label:string;color:string}> = {
  agendada:    {label:"Agendada",     color:"bg-blue-100 text-blue-700"},
  em_andamento:{label:"Em andamento", color:"bg-yellow-100 text-yellow-700"},
  concluida:   {label:"Concluída",    color:"bg-green-100 text-green-700"},
  cancelada:   {label:"Cancelada",    color:"bg-gray-100 text-gray-600"},
};
const FINDING_META: Record<string,{label:string;icon:typeof AlertTriangle;color:string}> = {
  nc:          {label:"NC",           icon:AlertTriangle, color:"text-red-500 bg-red-50 border-red-100"},
  observacao:  {label:"Observação",   icon:MessageSquare, color:"text-blue-500 bg-blue-50 border-blue-100"},
  oportunidade:{label:"Oportunidade", icon:Lightbulb,     color:"text-amber-500 bg-amber-50 border-amber-100"},
};

function fmt(d: string) { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR"); }

export function AuditoriasTab({ sector, isAdmin, setores }: Props) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<{audit:Audit;findings:Finding[]}|null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [addingFinding, setAddingFinding] = useState(false);
  const [findingForm, setFindingForm] = useState({ finding_type:"nc", description:"", sector: sector ?? "", create_nc:false });
  const [findingSaving, setFindingSaving] = useState(false);

  const [form, setForm] = useState({ title:"", audit_type:"interna", auditor_external:"", scope:"", audit_date:"" });

  useEffect(() => { setFindingForm(f => ({ ...f, sector: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/qualidade/auditorias");
      const d = await r.json();
      let data: Audit[] = d.audits || [];
      // client-side sector filter via scope
      if (sector) data = data.filter(a => (a.scope ?? "").toLowerCase().includes(sector.toLowerCase()));
      setAudits(data);
    } finally { setLoading(false); }
  }, [sector]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    const r = await fetch(`/api/qualidade/auditorias/${id}`);
    const d = await r.json();
    setSelected({ audit: d.audit, findings: d.findings || [] });
  };

  async function createAudit() {
    if (!form.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const scope = sector ? `${sector}${form.scope ? ` — ${form.scope}` : ""}` : form.scope;
    const r = await fetch("/api/qualidade/auditorias", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...form, scope }),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowForm(false);
    setForm({ title:"",audit_type:"interna",auditor_external:"",scope:"",audit_date:"" });
    load(); setSaving(false);
  }

  async function updateStatus(auditId: string, status: string) {
    await fetch(`/api/qualidade/auditorias/${auditId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status }),
    });
    load();
    if (selected?.audit.id === auditId) {
      const r = await fetch(`/api/qualidade/auditorias/${auditId}`);
      const d = await r.json();
      setSelected({ audit: d.audit, findings: d.findings || [] });
    }
  }

  async function addFinding(auditId: string) {
    if (!findingForm.description.trim()) return;
    setFindingSaving(true);
    await fetch(`/api/qualidade/auditorias/${auditId}/findings`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...findingForm, nc_severity:"menor", nc_category:"processo", nc_origin:"auditoria_interna" }),
    });
    setFindingForm({ finding_type:"nc", description:"", sector:sector??"", create_nc:false });
    setAddingFinding(false);
    const r = await fetch(`/api/qualidade/auditorias/${auditId}`);
    const d = await r.json();
    setSelected({ audit: d.audit, findings: d.findings || [] });
    setFindingSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{audits.length} auditoria{audits.length !== 1 ? "s" : ""}{sector ? ` · ${sector}` : ""}</p>
        {isAdmin && <Button onClick={() => setShowForm(true)}><Plus size={14} /> Nova Auditoria</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : audits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><ClipboardList size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhuma auditoria cadastrada{sector ? ` para ${sector}` : ""}.</p></div>
      ) : (
        <div className="space-y-2">
          {audits.map(audit => (
            <button key={audit.id} onClick={() => openDetail(audit.id)}
              className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-primary/30 transition-all">
              <Badge className={`text-xs border-0 shrink-0 ${audit.audit_type === "interna" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"}`}>
                {audit.audit_type === "interna" ? "Interna" : "Externa"}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{audit.title}</p>
                <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                  {audit.audit_date && <span>{fmt(audit.audit_date)}</span>}
                  {(audit.auditor || audit.auditor_external) && <span>{audit.auditor?.full_name ?? audit.auditor_external}</span>}
                </div>
              </div>
              <Badge className={`text-xs border-0 shrink-0 ${STATUS_META[audit.status]?.color}`}>{STATUS_META[audit.status]?.label}</Badge>
              <ChevronRight size={15} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Auditoria{sector ? ` — ${sector}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Tipo *</Label>
                <Select value={form.audit_type} onValueChange={v => setForm({...form,audit_type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="interna">Interna</SelectItem><SelectItem value="externa">Externa</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Data prevista</Label><Input type="date" value={form.audit_date} onChange={e => setForm({...form,audit_date:e.target.value})} /></div>
            </div>
            <div><Label className="text-xs">Auditor externo</Label><Input value={form.auditor_external} onChange={e => setForm({...form,auditor_external:e.target.value})} placeholder="Nome ou empresa" /></div>
            <div><Label className="text-xs">Escopo adicional</Label><Textarea rows={2} value={form.scope} onChange={e => setForm({...form,scope:e.target.value})} placeholder="O que será auditado..." /></div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createAudit} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
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
                  <div><DialogTitle>{selected.audit.title}</DialogTitle>
                    {selected.audit.audit_date && <p className="text-sm text-muted-foreground mt-0.5">{fmt(selected.audit.audit_date)}</p>}
                  </div>
                  <Badge className={`text-xs border-0 shrink-0 ${STATUS_META[selected.audit.status]?.color}`}>{STATUS_META[selected.audit.status]?.label}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{selected.audit.audit_type}</p></div>
                  {(selected.audit.auditor || selected.audit.auditor_external) && <div><p className="text-xs text-muted-foreground">Auditor</p><p className="font-medium">{selected.audit.auditor?.full_name ?? selected.audit.auditor_external}</p></div>}
                  {selected.audit.scope && <div className="col-span-2"><p className="text-xs text-muted-foreground">Escopo</p><p className="font-medium">{selected.audit.scope}</p></div>}
                </div>

                {isAdmin && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_META).map(([s,m]) => (
                        <button key={s} onClick={() => updateStatus(selected.audit.id, s)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            selected.audit.status === s ? `${m.color} border-current` : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                          }`}>{m.label}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Achados ({selected.findings.length})</p>
                    {isAdmin && <Button size="sm" variant="outline" onClick={() => setAddingFinding(v => !v)}><Plus size={12} />Registrar achado</Button>}
                  </div>
                  {addingFinding && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div><Label className="text-xs">Tipo *</Label>
                          <Select value={findingForm.finding_type} onValueChange={v => setFindingForm({...findingForm,finding_type:v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nc">Não-Conformidade</SelectItem>
                              <SelectItem value="observacao">Observação</SelectItem>
                              <SelectItem value="oportunidade">Oportunidade</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-xs">Setor</Label>
                          {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                            <Select value={findingForm.sector} onValueChange={v => setFindingForm({...findingForm,sector:v})}>
                              <SelectTrigger><SelectValue placeholder="Setor..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Geral</SelectItem>
                                {setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div><Label className="text-xs">Descrição *</Label><Textarea rows={2} value={findingForm.description} onChange={e => setFindingForm({...findingForm,description:e.target.value})} /></div>
                      {findingForm.finding_type === "nc" && (
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={findingForm.create_nc} onChange={e => setFindingForm({...findingForm,create_nc:e.target.checked})} className="accent-primary" />
                          Criar NC automaticamente
                        </label>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addFinding(selected.audit.id)} disabled={findingSaving}>{findingSaving ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingFinding(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                  {selected.findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum achado registrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.findings.map(f => {
                        const fm = FINDING_META[f.finding_type];
                        return (
                          <div key={f.id} className={`flex gap-3 rounded-lg border p-3 ${fm?.color ?? ""}`}>
                            <fm.icon size={16} className="shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold">{fm?.label}</span>
                                {f.sector && <span className="text-xs text-muted-foreground">· {f.sector}</span>}
                              </div>
                              <p className="text-sm">{f.description}</p>
                              {f.nc && <p className="text-xs mt-1 text-muted-foreground">NC: <span className="font-mono">{f.nc.number}</span> — {f.nc.title}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
