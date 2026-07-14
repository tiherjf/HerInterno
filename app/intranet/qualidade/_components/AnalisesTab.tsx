"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Plus, Loader2, ChevronRight, GitBranch, Users, Calendar } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Analysis {
  id: string; title: string; analysis_date: string | null; next_date: string | null;
  status: string; participants: string[] | null; agenda: string | null;
  decisions: string | null; observations: string | null; sector: string | null;
  creator: { full_name: string } | null;
}
interface Ishikawa {
  id: string; title: string; sector: string | null;
  metodo: string[]; mao_de_obra: string[]; maquina: string[];
  material: string[]; meio_ambiente: string[]; medicao: string[];
  creator: { full_name: string } | null; created_at: string;
}

const STATUS_META: Record<string,{label:string;color:string}> = {
  agendada:  { label:"Agendada",     color:"bg-blue-100 text-blue-700" },
  realizada: { label:"Realizada",    color:"bg-green-100 text-green-700" },
  cancelada: { label:"Cancelada",    color:"bg-gray-100 text-gray-600" },
};

const M6_CATEGORIES = [
  { key:"metodo",      label:"Método",         color:"bg-blue-50 border-blue-200 text-blue-700" },
  { key:"mao_de_obra", label:"Mão de Obra",    color:"bg-purple-50 border-purple-200 text-purple-700" },
  { key:"maquina",     label:"Máquina",        color:"bg-orange-50 border-orange-200 text-orange-700" },
  { key:"material",    label:"Material",       color:"bg-yellow-50 border-yellow-200 text-yellow-700" },
  { key:"meio_ambiente",label:"Meio Ambiente", color:"bg-green-50 border-green-200 text-green-700" },
  { key:"medicao",     label:"Medição",        color:"bg-red-50 border-red-200 text-red-700" },
] as const;

type M6Key = typeof M6_CATEGORIES[number]["key"];

function fmt(d: string) { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR"); }

function IshikawaView({ ish }: { ish: Ishikawa }) {
  const data = ish as unknown as Record<string, string[]>;
  return (
    <div className="space-y-3">
      {/* Effect */}
      <div className="bg-gray-800 text-white rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Efeito / Problema</p>
        <p className="font-semibold">{ish.title}</p>
      </div>
      {/* 6M grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {M6_CATEGORIES.map(({ key, label, color }) => {
          const causes: string[] = data[key] ?? [];
          return (
            <div key={key} className={`rounded-xl border p-3 ${color}`}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2">{label}</p>
              {causes.length === 0
                ? <p className="text-xs opacity-60 italic">Sem causas</p>
                : <ul className="space-y-1">{causes.map((c,i) => <li key={i} className="text-xs flex gap-1.5"><span className="opacity-60">→</span>{c}</li>)}</ul>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalisesTab({ sector, isAdmin, setores }: Props) {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [ishikawaList, setIshikawaList] = useState<Ishikawa[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reunioes"|"ishikawa">("reunioes");

  const [showMeetForm, setShowMeetForm] = useState(false);
  const [showIshForm, setShowIshForm] = useState(false);
  const [selectedMeet, setSelectedMeet] = useState<Analysis | null>(null);
  const [selectedIsh, setSelectedIsh] = useState<Ishikawa | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [meetForm, setMeetForm] = useState({
    title:"", analysis_date:"", next_date:"", sector:sector??"",
    agenda:"", decisions:"", participants:"", status:"agendada",
  });

  const initCauses: Record<M6Key, string> = { metodo:"", mao_de_obra:"", maquina:"", material:"", meio_ambiente:"", medicao:"" };
  const [ishForm, setIshForm] = useState({ title:"", sector:sector??"" });
  const [causes, setCauses] = useState<Record<M6Key, string>>(initCauses);

  useEffect(() => {
    setMeetForm(f => ({ ...f, sector: sector ?? "" }));
    setIshForm(f => ({ ...f, sector: sector ?? "" }));
  }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      const r = await fetch(`/api/qualidade/analises?${params}`);
      const d = await r.json();
      setAnalyses(d.analyses || []);
      setIshikawaList(d.ishikawa || []);
    } finally { setLoading(false); }
  }, [sector]);

  useEffect(() => { load(); }, [load]);

  async function createMeeting() {
    if (!meetForm.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const participants = meetForm.participants
      ? meetForm.participants.split(",").map(p => p.trim()).filter(Boolean)
      : [];
    const r = await fetch("/api/qualidade/analises", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...meetForm, participants }),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowMeetForm(false);
    setMeetForm({ title:"",analysis_date:"",next_date:"",sector:sector??"",agenda:"",decisions:"",participants:"",status:"agendada" });
    load(); setSaving(false);
  }

  async function createIshikawa() {
    if (!ishForm.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const payload: Record<string, unknown> = { type:"ishikawa", ...ishForm };
    for (const { key } of M6_CATEGORIES) {
      payload[key] = causes[key] ? causes[key].split("\n").map(s => s.trim()).filter(Boolean) : [];
    }
    const r = await fetch("/api/qualidade/analises", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowIshForm(false);
    setIshForm({ title:"", sector:sector??"" });
    setCauses(initCauses);
    load(); setSaving(false);
  }

  async function updateMeetStatus(id: string, status: string) {
    await fetch(`/api/qualidade/analises/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status }),
    });
    load();
    if (selectedMeet?.id === id) setSelectedMeet(prev => prev ? {...prev, status} : null);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-0 border-b overflow-x-auto scrollbar-none">
        {[
          { id:"reunioes" as const, label:"Reuniões de Análise", icon:Calendar },
          { id:"ishikawa" as const, label:"Ishikawa (6M)",       icon:GitBranch },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all whitespace-nowrap ${
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700"
            }`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : tab === "reunioes" ? (
        <>
          <div className="flex justify-end">
            {isAdmin && <Button onClick={() => setShowMeetForm(true)}><Plus size={14} /> Nova Reunião</Button>}
          </div>
          {analyses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Brain size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhuma análise crítica registrada.</p></div>
          ) : (
            <div className="space-y-2">
              {analyses.map(a => (
                <button key={a.id} onClick={() => setSelectedMeet(a)}
                  className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.title}</p>
                    <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                      {a.analysis_date && <span className="flex items-center gap-1"><Calendar size={10} />{fmt(a.analysis_date)}</span>}
                      {a.sector && <span>{a.sector}</span>}
                      {a.participants && a.participants.length > 0 && <span className="flex items-center gap-1"><Users size={10} />{a.participants.length} participantes</span>}
                    </div>
                  </div>
                  <Badge className={`text-xs border-0 shrink-0 ${STATUS_META[a.status]?.color}`}>{STATUS_META[a.status]?.label}</Badge>
                  <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end">
            {isAdmin && <Button onClick={() => setShowIshForm(true)}><Plus size={14} /> Novo Ishikawa</Button>}
          </div>
          {ishikawaList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><GitBranch size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhum diagrama Ishikawa registrado.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ishikawaList.map(ish => (
                <button key={ish.id} onClick={() => setSelectedIsh(ish)}
                  className="text-left bg-white border rounded-xl p-4 hover:shadow-md transition-all">
                  <p className="font-semibold text-gray-900 mb-1">{ish.title}</p>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    {ish.sector && <span>{ish.sector}</span>}
                    {M6_CATEGORIES.map(({ key, label }) => {
                      const data = ish as unknown as Record<string, string[]>;
                      const count = (data[key] ?? []).length;
                      if (count === 0) return null;
                      return <span key={key}>{label}: {count}</span>;
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Meeting create dialog */}
      <Dialog open={showMeetForm} onOpenChange={setShowMeetForm}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Reunião de Análise Crítica</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Título *</Label><Input value={meetForm.title} onChange={e => setMeetForm({...meetForm,title:e.target.value})} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Data da reunião</Label><Input type="date" value={meetForm.analysis_date} onChange={e => setMeetForm({...meetForm,analysis_date:e.target.value})} /></div>
              <div><Label className="text-xs">Próxima reunião</Label><Input type="date" value={meetForm.next_date} onChange={e => setMeetForm({...meetForm,next_date:e.target.value})} /></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={meetForm.status} onValueChange={v => setMeetForm({...meetForm,status:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Setor</Label>
                {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                  <Select value={meetForm.sector} onValueChange={v => setMeetForm({...meetForm,sector:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">Geral</SelectItem>{setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div><Label className="text-xs">Participantes (separados por vírgula)</Label><Input value={meetForm.participants} onChange={e => setMeetForm({...meetForm,participants:e.target.value})} placeholder="João, Maria, Carlos..." /></div>
            <div><Label className="text-xs">Pauta</Label><Textarea rows={3} value={meetForm.agenda} onChange={e => setMeetForm({...meetForm,agenda:e.target.value})} /></div>
            <div><Label className="text-xs">Decisões / Ações</Label><Textarea rows={3} value={meetForm.decisions} onChange={e => setMeetForm({...meetForm,decisions:e.target.value})} /></div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowMeetForm(false)}>Cancelar</Button>
              <Button onClick={createMeeting} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ishikawa create dialog */}
      <Dialog open={showIshForm} onOpenChange={setShowIshForm}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Diagrama de Ishikawa (6M)</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label className="text-xs">Efeito / Problema *</Label><Input value={ishForm.title} onChange={e => setIshForm({...ishForm,title:e.target.value})} placeholder="Qual é o problema a analisar?" /></div>
              <div><Label className="text-xs">Setor</Label>
                {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                  <Select value={ishForm.sector} onValueChange={v => setIshForm({...ishForm,sector:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">Geral</SelectItem>{setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Digite as causas de cada categoria, uma por linha.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {M6_CATEGORIES.map(({ key, label, color }) => (
                <div key={key} className={`rounded-lg border p-3 ${color}`}>
                  <Label className="text-xs font-bold">{label}</Label>
                  <Textarea
                    className="mt-1.5 bg-white text-xs"
                    rows={3}
                    placeholder={`Causas de ${label.toLowerCase()}...`}
                    value={causes[key]}
                    onChange={e => setCauses(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowIshForm(false)}>Cancelar</Button>
              <Button onClick={createIshikawa} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting detail */}
      <Dialog open={!!selectedMeet} onOpenChange={o => !o && setSelectedMeet(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedMeet && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMeet.title}</DialogTitle>
                {selectedMeet.sector && <p className="text-sm text-muted-foreground">{selectedMeet.sector}</p>}
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{selectedMeet.analysis_date ? fmt(selectedMeet.analysis_date) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Próxima</p><p className="font-medium">{selectedMeet.next_date ? fmt(selectedMeet.next_date) : "—"}</p></div>
                  <Badge className={`text-xs border-0 ${STATUS_META[selectedMeet.status]?.color}`}>{STATUS_META[selectedMeet.status]?.label}</Badge>
                </div>
                {selectedMeet.participants && selectedMeet.participants.length > 0 && (
                  <div><p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Participantes</p>
                    <div className="flex flex-wrap gap-1.5">{selectedMeet.participants.map((p,i) => <Badge key={i} className="bg-gray-100 text-gray-700 border-0 text-xs">{p}</Badge>)}</div>
                  </div>
                )}
                {selectedMeet.agenda && <div><p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Pauta</p><p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedMeet.agenda}</p></div>}
                {selectedMeet.decisions && <div><p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Decisões</p><p className="text-sm bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedMeet.decisions}</p></div>}
                {isAdmin && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                    <div className="flex gap-2">
                      {Object.entries(STATUS_META).map(([s,m]) => (
                        <button key={s} onClick={() => updateMeetStatus(selectedMeet.id, s)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            selectedMeet.status === s ? `${m.color} border-current` : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
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

      {/* Ishikawa detail */}
      <Dialog open={!!selectedIsh} onOpenChange={o => !o && setSelectedIsh(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedIsh && (
            <>
              <DialogHeader><DialogTitle>Diagrama de Ishikawa</DialogTitle></DialogHeader>
              <div className="pt-2"><IshikawaView ish={selectedIsh} /></div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
