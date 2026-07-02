"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Plus, Loader2, ExternalLink, CheckCircle2, Clock, BookOpen } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Doc {
  id: string; code: string | null; title: string; doc_type: string; category: string | null;
  version: string; status: string; requires_reading: boolean; valid_from: string | null;
  valid_until: string | null; file_url: string | null; created_at: string;
  creator: { full_name: string } | null; approver: { full_name: string } | null;
  user_has_read: boolean;
}

const DOC_TYPE_LABELS: Record<string,string> = {
  pop:"POP", protocolo:"Protocolo", politica:"Política",
  manual:"Manual", instrucao:"Instrução de Trabalho", formulario:"Formulário",
};
const DOC_TYPE_COLORS: Record<string,string> = {
  pop:"bg-blue-100 text-blue-700", protocolo:"bg-purple-100 text-purple-700",
  politica:"bg-red-100 text-red-700", manual:"bg-orange-100 text-orange-700",
  instrucao:"bg-teal-100 text-teal-700", formulario:"bg-gray-100 text-gray-700",
};
const STATUS_META: Record<string,{label:string;color:string}> = {
  rascunho: {label:"Rascunho",  color:"bg-gray-100 text-gray-600"},
  revisao:  {label:"Em revisão",color:"bg-yellow-100 text-yellow-700"},
  aprovado: {label:"Aprovado",  color:"bg-blue-100 text-blue-700"},
  publicado:{label:"Publicado", color:"bg-green-100 text-green-700"},
  obsoleto: {label:"Obsoleto",  color:"bg-red-100 text-red-600"},
};

function fmt(d: string) { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR"); }
function isExpiring(d: Doc) {
  if (!d.valid_until) return false;
  const diff = new Date(d.valid_until).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

export function DocumentosTab({ sector, isAdmin, setores }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmingRead, setConfirmingRead] = useState<string|null>(null);

  const [form, setForm] = useState({
    code:"", title:"", doc_type:"pop", category: sector ?? "",
    file_url:"", requires_reading:false, valid_from:"", valid_until:"",
  });

  useEffect(() => { setForm(f => ({ ...f, category: sector ?? "" })); }, [sector]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      const r = await fetch(`/api/qualidade/documentos?${params}`);
      const d = await r.json();
      let data: Doc[] = d.documents || [];
      // client-side sector filter (docs use category as sector label)
      if (sector) data = data.filter(doc => (doc.category ?? "").toLowerCase() === sector.toLowerCase());
      // client-side search
      if (search) data = data.filter(doc => doc.title.toLowerCase().includes(search.toLowerCase()) || (doc.code ?? "").toLowerCase().includes(search.toLowerCase()));
      setDocs(data);
    } finally { setLoading(false); }
  }, [filterType, sector, search]);

  useEffect(() => { load(); }, [load]);

  async function createDoc() {
    if (!form.title.trim()) { setFormError("Título é obrigatório"); return; }
    setSaving(true); setFormError("");
    const r = await fetch("/api/qualidade/documentos", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { setFormError(d.error || "Erro"); setSaving(false); return; }
    setShowForm(false);
    setForm({ code:"",title:"",doc_type:"pop",category:sector??"",file_url:"",requires_reading:false,valid_from:"",valid_until:"" });
    load(); setSaving(false);
  }

  async function updateStatus(docId: string, status: string) {
    await fetch(`/api/qualidade/documentos/${docId}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status }),
    });
    load();
    if (selected?.id === docId) setSelected(prev => prev ? {...prev, status} : null);
  }

  async function confirmRead(docId: string) {
    setConfirmingRead(docId);
    await fetch(`/api/qualidade/documentos/${docId}/read`, { method:"POST" });
    setConfirmingRead(null);
    load();
    if (selected?.id === docId) setSelected(prev => prev ? {...prev, user_has_read:true} : null);
  }

  const grouped = Object.entries(DOC_TYPE_LABELS).map(([type, label]) => ({
    type, label,
    docs: docs.filter(d => d.doc_type === type && (!filterType || d.doc_type === filterType)),
  })).filter(g => g.docs.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2">
          <Input className="w-52" placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Tipo de documento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os tipos</SelectItem>
              {Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && <Button onClick={() => setShowForm(true)}><Plus size={14} /> Novo Documento</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><FileText size={32} className="mx-auto mb-2 opacity-25" /><p className="text-sm">Nenhum documento{sector ? ` para ${sector}` : ""} encontrado.</p></div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, label, docs: gDocs }) => (
            <div key={type}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Badge className={`${DOC_TYPE_COLORS[type]} text-xs border-0`}>{label}</Badge>
                <span className="text-gray-400">{gDocs.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gDocs.map(doc => (
                  <button key={doc.id} onClick={() => setSelected(doc)}
                    className="text-left bg-white border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {doc.code && <p className="text-xs font-mono text-muted-foreground">{doc.code}</p>}
                        <p className="font-semibold text-sm text-gray-900">{doc.title}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Badge className={`text-xs border-0 ${STATUS_META[doc.status]?.color ?? ""}`}>{STATUS_META[doc.status]?.label}</Badge>
                        <span className="text-xs text-muted-foreground">v{doc.version}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {doc.valid_until && <span className={`flex items-center gap-1 ${isExpiring(doc) ? "text-amber-600 font-medium" : ""}`}><Clock size={10} />válido até {fmt(doc.valid_until)}</span>}
                      {doc.requires_reading && (
                        doc.user_has_read
                          ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={10} />Lido</span>
                          : <span className="flex items-center gap-1 text-orange-600"><BookOpen size={10} />Leitura obrigatória</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Código</Label><Input value={form.code} onChange={e => setForm({...form,code:e.target.value})} placeholder="POP-001" /></div>
              <div><Label className="text-xs">Tipo *</Label>
                <Select value={form.doc_type} onValueChange={v => setForm({...form,doc_type:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></div>
            <div><Label className="text-xs">Setor / Categoria</Label>
              {sector ? <Input value={sector} disabled className="bg-gray-50" /> : (
                <Select value={form.category} onValueChange={v => setForm({...form,category:v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Geral</SelectItem>
                    {setores.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div><Label className="text-xs">URL do arquivo (PDF/link)</Label><Input value={form.file_url} onChange={e => setForm({...form,file_url:e.target.value})} placeholder="https://..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Válido de</Label><Input type="date" value={form.valid_from} onChange={e => setForm({...form,valid_from:e.target.value})} /></div>
              <div><Label className="text-xs">Válido até</Label><Input type="date" value={form.valid_until} onChange={e => setForm({...form,valid_until:e.target.value})} /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requires_reading} onChange={e => setForm({...form,requires_reading:e.target.checked})} className="accent-primary" />
              <span className="text-sm">Leitura obrigatória (colaboradores devem confirmar)</span>
            </label>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={createDoc} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : "Criar"}</Button>
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
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {selected.code && <p className="text-xs font-mono text-muted-foreground">{selected.code} · v{selected.version}</p>}
                    <DialogTitle>{selected.title}</DialogTitle>
                  </div>
                  <Badge className={`text-xs border-0 shrink-0 ${DOC_TYPE_COLORS[selected.doc_type]}`}>{DOC_TYPE_LABELS[selected.doc_type]}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`text-xs border-0 mt-1 ${STATUS_META[selected.status]?.color}`}>{STATUS_META[selected.status]?.label}</Badge></div>
                  {selected.category && <div><p className="text-xs text-muted-foreground">Setor</p><p className="font-medium">{selected.category}</p></div>}
                  {selected.valid_from && <div><p className="text-xs text-muted-foreground">Válido de</p><p className="font-medium">{fmt(selected.valid_from)}</p></div>}
                  {selected.valid_until && <div><p className="text-xs text-muted-foreground">Válido até</p><p className={`font-medium ${isExpiring(selected) ? "text-amber-600" : ""}`}>{fmt(selected.valid_until)}</p></div>}
                  {selected.creator && <div><p className="text-xs text-muted-foreground">Criado por</p><p className="font-medium">{selected.creator.full_name}</p></div>}
                  {selected.approver && <div><p className="text-xs text-muted-foreground">Aprovado por</p><p className="font-medium">{selected.approver.full_name}</p></div>}
                </div>
                {selected.file_url && (
                  <a href={selected.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
                    <ExternalLink size={14} /> Abrir documento
                  </a>
                )}
                {selected.requires_reading && (
                  <div className={`rounded-lg p-3 border ${selected.user_has_read ? "bg-green-50 border-green-100" : "bg-orange-50 border-orange-100"}`}>
                    {selected.user_has_read ? (
                      <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 size={16} />Você confirmou a leitura.</p>
                    ) : (
                      <div>
                        <p className="text-sm text-orange-700 mb-2">Este documento requer confirmação de leitura.</p>
                        <Button size="sm" onClick={() => confirmRead(selected.id)} disabled={confirmingRead === selected.id}>
                          {confirmingRead === selected.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} />Confirmar leitura</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alterar status</p>
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
