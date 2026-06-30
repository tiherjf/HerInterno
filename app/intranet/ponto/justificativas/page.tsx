"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock, FileCheck, FileX, Hourglass, Plus, Loader2, AlertCircle, Paperclip,
} from "lucide-react";
import Link from "next/link";

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
  manager_observation: string | null;
  manager_reviewed_at: string | null;
  rh_observation: string | null;
  rh_reviewed_at: string | null;
  created_at: string;
  justification_types: { name: string };
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:          { label: "Aguardando Gestor", color: "bg-yellow-100 text-yellow-800", icon: Hourglass },
  manager_approved: { label: "Aguardando RH",     color: "bg-blue-100 text-blue-800",    icon: Hourglass },
  manager_rejected: { label: "Recusada pelo Gestor", color: "bg-red-100 text-red-800",   icon: FileX },
  approved:         { label: "Aprovada",           color: "bg-green-100 text-green-800",  icon: FileCheck },
  rejected:         { label: "Recusada pelo RH",   color: "bg-red-100 text-red-800",      icon: FileX },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default function MinhasJustificativasPage() {
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Justification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ponto/justificativas?view=own");
      const d = await res.json();
      setJustifications(d.justifications || []);
    } catch {
      setJustifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all"
    ? justifications
    : justifications.filter(j => j.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Minhas Justificativas</h2>
          <p className="text-muted-foreground">{justifications.length} justificativa(s) no total</p>
        </div>
        <Link href="/intranet/ponto/justificativas/nova">
          <Button><Plus size={16} /> Nova</Button>
        </Link>
      </div>

      {/* Filtro */}
      <div className="max-w-xs">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Aguardando Gestor</SelectItem>
            <SelectItem value="manager_approved">Aguardando RH</SelectItem>
            <SelectItem value="manager_rejected">Recusada pelo Gestor</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Recusadas pelo RH</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Nenhuma justificativa encontrada.</p>
          <Link href="/intranet/ponto/justificativas/nova" className="mt-3 inline-block">
            <Button variant="outline" size="sm">Criar primeira justificativa</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((j) => {
            const info = STATUS_INFO[j.status] || STATUS_INFO.pending;
            const Icon = info.icon;
            const isExpired = new Date(j.deadline) < new Date() && j.status === "pending";
            return (
              <Card
                key={j.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(j)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${info.color.replace("text-", "text-").split(" ")[0]} opacity-80`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{j.justification_types?.name}</span>
                          {j.document_url && (
                            <span title="Com anexo">
                              <Paperclip size={12} className="text-muted-foreground" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ocorrência: {fmt(j.occurrence_date)}
                          {!j.is_full_day && j.start_time && ` · ${j.start_time}–${j.end_time}`}
                          {" · "}Enviada em {fmt(j.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-xs border-0 ${info.color}`}>{info.label}</Badge>
                      {isExpired && (
                        <span className="text-xs text-red-500">Prazo expirou</span>
                      )}
                    </div>
                  </div>

                  {/* Feedback de rejeição visível direto no card */}
                  {(j.status === "manager_rejected" || j.status === "rejected") && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded-lg">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>
                        {j.status === "manager_rejected"
                          ? j.manager_observation || "Recusada pelo gestor sem observação."
                          : j.rh_observation || "Recusada pelo RH sem observação."
                        }
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.justification_types?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ocorrência</p>
                  <p className="font-medium">{fmt(selected.occurrence_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {selected.is_full_day ? "Dia todo" : `${selected.start_time} – ${selected.end_time}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prazo para análise</p>
                  <p className="font-medium">{fmt(selected.deadline)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={`text-xs border-0 ${STATUS_INFO[selected.status]?.color}`}>
                    {STATUS_INFO[selected.status]?.label}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">{selected.description}</p>
              </div>
              {selected.document_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Comprovante</p>
                  <a href={selected.document_url} target="_blank" rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline flex items-center gap-1">
                    <Paperclip size={14} /> Ver documento anexado
                  </a>
                </div>
              )}
              {/* Resposta do gestor */}
              {selected.manager_reviewed_at && (
                <div className={`p-3 rounded-lg ${
                  selected.status === "manager_rejected" ? "bg-red-50" : "bg-green-50"
                }`}>
                  <p className="text-xs font-semibold mb-1">
                    Gestor — {fmt(selected.manager_reviewed_at)}
                  </p>
                  <p>{selected.manager_observation || "Sem observação."}</p>
                </div>
              )}
              {/* Resposta do RH */}
              {selected.rh_reviewed_at && (
                <div className={`p-3 rounded-lg ${
                  selected.status === "rejected" ? "bg-red-50" : "bg-green-50"
                }`}>
                  <p className="text-xs font-semibold mb-1">
                    RH — {fmt(selected.rh_reviewed_at)}
                  </p>
                  <p>{selected.rh_observation || "Sem observação."}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
