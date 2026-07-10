"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Clock, Paperclip, AlertCircle, CheckSquare, Square } from "lucide-react";

interface Justification {
  id: string;
  occurrence_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  description: string;
  document_url: string | null;
  deadline: string;
  status: string;
  created_at: string;
  profiles: { full_name: string; sector: string };
  justification_types: { name: string; requires_document: boolean };
}

function fmt(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function AprovacoesPage() {
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Justification | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Seleção em lote
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);
  const [batchObs, setBatchObs] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setChecked(new Set());
    try {
      const res = await fetch("/api/ponto/justificativas?view=team");
      const d = await res.json();
      setJustifications(d.justifications || []);
    } catch {
      setJustifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleCheck(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === justifications.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(justifications.map(j => j.id)));
    }
  }

  function openAction(j: Justification, act: "approve" | "reject") {
    setSelected(j);
    setAction(act);
    setObservation("");
    setError("");
  }

  async function handleAction() {
    if (!selected || !action) return;
    if (action === "reject" && !observation.trim()) {
      setError("Informe o motivo da recusa.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ponto/justificativas/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "approve" ? "manager_approve" : "manager_reject",
          observation: observation.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Erro ao processar."); return; }
      setSelected(null);
      setAction(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleBatch() {
    if (!batchAction || checked.size === 0) return;
    if (batchAction === "reject" && !batchObs.trim()) {
      setBatchError("Informe o motivo da recusa em lote.");
      return;
    }
    setBatchSaving(true);
    setBatchError("");
    try {
      const res = await fetch("/api/ponto/justificativas/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(checked),
          action: batchAction === "approve" ? "manager_approve" : "manager_reject",
          observation: batchObs.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setBatchError(d.error || "Erro"); return; }
      setBatchAction(null);
      setBatchObs("");
      load();
    } finally {
      setBatchSaving(false);
    }
  }

  const expired = (j: Justification) => new Date(j.deadline + "T00:00:00") < new Date();
  const allChecked = justifications.length > 0 && checked.size === justifications.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Aprovações de Gestor</h2>
          <p className="text-muted-foreground">
            {justifications.length === 0
              ? "Nenhuma justificativa aguardando sua aprovação."
              : `${justifications.length} justificativa(s) aguardando análise.`}
          </p>
        </div>
        {justifications.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={toggleAll}>
            {allChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
            Selecionar todas
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : justifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Tudo em dia!</p>
          <p className="text-sm">Nenhuma justificativa pendente de aprovação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {justifications.map((j) => (
            <Card key={j.id} className={`${expired(j) ? "border-red-200 bg-red-50/50" : ""} ${checked.has(j.id) ? "ring-2 ring-blue-400" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <Button variant="ghost" size="icon" className="mt-1 shrink-0 w-6 h-6 p-0"
                    onClick={() => toggleCheck(j.id)}>
                    {checked.has(j.id)
                      ? <CheckSquare size={18} className="text-blue-600" />
                      : <Square size={18} className="text-gray-400" />}
                  </Button>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{j.profiles?.full_name}</span>
                      <Badge variant="secondary" className="text-xs">{j.profiles?.sector}</Badge>
                      <Badge className="text-xs bg-blue-50 text-blue-700 border-0">{j.justification_types?.name}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Ocorrência: <strong className="text-foreground">{fmt(j.occurrence_date)}</strong>
                      {!j.is_full_day && j.start_time && ` · ${j.start_time}–${j.end_time}`}
                      {" · "}Enviada em {new Date(j.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <p className="text-sm bg-white border p-3 rounded-lg">{j.description}</p>
                    <div className="flex items-center gap-3">
                      {j.document_url && (
                        <a href={`/api/ponto/justificativas/${j.id}/comprovante`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Paperclip size={12} /> Ver comprovante
                        </a>
                      )}
                      {expired(j) ? (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle size={12} /> Prazo vencido ({fmt(j.deadline)})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={12} /> Prazo: {fmt(j.deadline)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => openAction(j, "approve")}>
                      <CheckCircle2 size={14} /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => openAction(j, "reject")}>
                      <XCircle size={14} /> Recusar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Barra de ação em lote */}
      {checked.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white rounded-xl px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium">{checked.size} selecionada(s)</span>
          <div className="w-px h-5 bg-gray-600" />
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => { setBatchAction("approve"); setBatchObs(""); setBatchError(""); }}>
            <CheckCircle2 size={14} /> Aprovar em lote
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { setBatchAction("reject"); setBatchObs(""); setBatchError(""); }}>
            <XCircle size={14} /> Recusar em lote
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs ml-1 h-6 px-2"
            onClick={() => setChecked(new Set())}>
            ✕ Limpar
          </Button>
        </div>
      )}

      {/* Dialog individual */}
      <Dialog open={!!selected && !!action} onOpenChange={() => { setSelected(null); setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "approve" ? "Aprovar Justificativa" : "Recusar Justificativa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p><strong>{selected.profiles?.full_name}</strong> — {selected.justification_types?.name}</p>
                <p className="text-muted-foreground">Ocorrência: {fmt(selected.occurrence_date)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observação {action === "reject" && <span className="text-red-500">*</span>}</Label>
              <Textarea
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder={action === "approve" ? "Observação opcional..." : "Informe o motivo da recusa (obrigatório)"}
                rows={3}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); }}>Cancelar</Button>
            <Button onClick={handleAction} disabled={saving}
              className={action === "reject" ? "bg-red-600 hover:bg-red-700" : ""}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : action === "approve" ? "Confirmar Aprovação" : "Confirmar Recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog lote */}
      <Dialog open={!!batchAction} onOpenChange={v => { if (!v) setBatchAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {batchAction === "approve" ? `Aprovar ${checked.size} justificativa(s)` : `Recusar ${checked.size} justificativa(s)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Observação {batchAction === "reject" && <span className="text-red-500">*</span>}</Label>
              <Textarea
                value={batchObs}
                onChange={e => setBatchObs(e.target.value)}
                placeholder={batchAction === "approve" ? "Observação opcional..." : "Motivo da recusa (obrigatório)"}
                rows={3}
              />
            </div>
            {batchError && (
              <Alert variant="destructive">
                <AlertDescription>{batchError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAction(null)}>Cancelar</Button>
            <Button onClick={handleBatch} disabled={batchSaving}
              className={batchAction === "reject" ? "bg-red-600 hover:bg-red-700" : ""}>
              {batchSaving ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
