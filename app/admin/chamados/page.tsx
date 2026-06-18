"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  User, BarChart2
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface Ticket {
  id: string; number: number; title: string; priority: string; status: string;
  requester_name: string; requester_sector: string | null;
  created_at: string; updated_at: string; sla_deadline: string | null;
  first_response_at: string | null; resolved_at: string | null; rating: number | null;
  ticket_categories: { id: string; name: string; color: string } | null;
  assigned: { id: string; full_name: string } | null;
}

interface Comment {
  id: string; author_name: string; content: string; is_internal: boolean; created_at: string;
}

const PRIORITY: Record<string, { label: string; color: string }> = {
  low:      { label: "Baixa",   color: "bg-blue-100 text-blue-700" },
  medium:   { label: "Média",   color: "bg-yellow-100 text-yellow-700" },
  high:     { label: "Alta",    color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700 font-bold" },
};

const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "Aberto",         color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "Em Atendimento", color: "bg-blue-100 text-blue-700" },
  resolved:    { label: "Resolvido",      color: "bg-green-100 text-green-700" },
  closed:      { label: "Encerrado",      color: "bg-green-100 text-green-700" },
  cancelled:   { label: "Cancelado",      color: "bg-red-100 text-red-700" },
};

function SlaChip({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline || ["resolved", "closed", "cancelled"].includes(status)) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return <span className="text-xs text-red-600 flex items-center gap-0.5"><AlertTriangle size={11} /> Vencido</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const color = diff < 3600000 ? "text-red-500" : diff < 7200000 ? "text-yellow-600" : "text-green-600";
  return <span className={`text-xs ${color}`}>{h > 0 ? `${h}h ${m}m` : `${m}min`}</span>;
}

const TABS = [
  { key: "",            label: "Todos" },
  { key: "unassigned",  label: "Não Atribuídos" },
  { key: "my_assigned", label: "Meus" },
  { key: "resolved",    label: "Resolvidos" },
];

export default function AdminChamadosPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [detail, setDetail] = useState<{ ticket: Ticket & { ticket_comments: Comment[]; description: string } } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actioning, setActioning] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: tab || "all", limit: "200" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/chamados?${params}`);
      const json = await res.json();
      setTickets(json.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openDetail = async (t: Ticket) => {
    setSelected(t);
    setDetail(null);
    setComment("");
    setIsInternal(false);
    setLoadingDetail(true);
    const res = await fetch(`/api/chamados/${t.id}`);
    const json = await res.json();
    setDetail(json);
    setLoadingDetail(false);
  };

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selected) return;
    setActioning(true);
    await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setActioning(false);
    fetchTickets();
    const res = await fetch(`/api/chamados/${selected.id}`);
    const json = await res.json();
    setDetail(json);
    setSelected(json.ticket);
  };

  const submitComment = async () => {
    if (!comment.trim() || !selected) return;
    setSubmittingComment(true);
    await fetch(`/api/chamados/${selected.id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment, is_internal: isInternal }),
    });
    setComment("");
    const res = await fetch(`/api/chamados/${selected.id}`);
    const json = await res.json();
    setDetail(json);
    setSubmittingComment(false);
  };

  const filteredTickets = tickets.filter(t => {
    if (tab === "resolved") return ["resolved", "closed"].includes(t.status);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chamados</h1>
          <p className="text-sm text-muted-foreground">Gestão de solicitações de suporte</p>
        </div>
        <Link href="/admin/chamados/indicadores">
          <Button variant="outline" size="sm">
            <BarChart2 size={16} /> Indicadores ONA
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
          placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Título</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Categoria</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prioridade</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Solicitante</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Responsável</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">SLA</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Abertura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filteredTickets.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum chamado</td></tr>
            ) : filteredTickets.map(t => (
              <tr
                key={t.id}
                onClick={() => openDetail(t)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  #{String(t.number).padStart(4, "0")}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="font-medium truncate block">{t.title}</span>
                </td>
                <td className="px-4 py-3">
                  {t.ticket_categories ? (
                    <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.ticket_categories.color }}>
                      {t.ticket_categories.name}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[t.priority]?.color}`}>
                    {PRIORITY[t.priority]?.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[t.status]?.color}`}>
                    {STATUS[t.status]?.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{t.requester_name}</div>
                  {t.requester_sector && <div className="text-xs">{t.requester_sector}</div>}
                </td>
                <td className="px-4 py-3">
                  {t.assigned ? (
                    <span className="flex items-center gap-1 text-sm"><User size={12} /> {t.assigned.full_name}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Não atribuído</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SlaChip deadline={t.sla_deadline} status={t.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDate(t.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal detalhe */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">#{String(selected.number).padStart(4,"0")}</span>
                  {selected.title}
                </DialogTitle>
              </DialogHeader>

              {/* Ações rápidas */}
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                {["open", "in_progress"].includes(selected.status) && (
                  <Button size="sm" variant="outline" onClick={() => doAction("assign")} disabled={actioning}>
                    <User size={14} /> {selected.assigned ? "Reatribuir para mim" : "Atribuir para mim"}
                  </Button>
                )}
                {selected.status === "open" && (
                  <Button size="sm" onClick={() => doAction("set_status", { status: "in_progress" })} disabled={actioning}>
                    <RefreshCw size={14} /> Iniciar Atendimento
                  </Button>
                )}
                {selected.status === "in_progress" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => doAction("set_status", { status: "resolved" })} disabled={actioning}>
                    <CheckCircle2 size={14} /> Resolver
                  </Button>
                )}
                {["open", "in_progress"].includes(selected.status) && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => doAction("set_status", { status: "cancelled" })} disabled={actioning}>
                    <XCircle size={14} /> Cancelar
                  </Button>
                )}
                {selected.status === "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => doAction("set_status", { status: "closed" })} disabled={actioning}>
                    <CheckCircle2 size={14} /> Encerrar
                  </Button>
                )}
              </div>

              {loadingDetail ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : detail ? (
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {selected.ticket_categories && (
                      <span className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: selected.ticket_categories.color }}>
                        {selected.ticket_categories.name}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY[selected.priority]?.color}`}>{PRIORITY[selected.priority]?.label}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS[selected.status]?.color}`}>{STATUS[selected.status]?.label}</span>
                    {selected.assigned && <span className="text-xs px-2 py-1 rounded-full bg-gray-100 flex items-center gap-1"><User size={11} />{selected.assigned.full_name}</span>}
                    <SlaChip deadline={selected.sla_deadline} status={selected.status} />
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Solicitante: <strong className="text-gray-700">{selected.requester_name}</strong> {selected.requester_sector && `(${selected.requester_sector})`}</div>
                    <div>Aberto em: <strong className="text-gray-700">{formatDate(selected.created_at)}</strong></div>
                    {selected.first_response_at && <div>Primeira resposta: <strong className="text-gray-700">{formatDate(selected.first_response_at)}</strong></div>}
                    {selected.resolved_at && <div>Resolvido em: <strong className="text-gray-700">{formatDate(selected.resolved_at)}</strong></div>}
                    {selected.rating && <div>Avaliação: <strong className="text-yellow-500">{"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}</strong></div>}
                  </div>

                  {/* Descrição */}
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">{detail.ticket.description}</div>

                  {/* Timeline */}
                  {detail.ticket.ticket_comments?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Histórico</p>
                      {detail.ticket.ticket_comments.map(c => (
                        <div key={c.id} className={`rounded-lg p-3 text-sm ${c.is_internal ? "bg-amber-50 border border-amber-200" : "bg-blue-50"}`}>
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{c.author_name}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-gray-700">{c.content}</p>
                          {c.is_internal && <span className="text-xs text-amber-600 mt-1 block">Nota interna</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adicionar atualização */}
                  {!["cancelled"].includes(selected.status) && (
                    <div>
                      <label className="text-sm font-medium">Adicionar atualização</label>
                      <textarea
                        className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none"
                        rows={3}
                        placeholder="Resposta ao solicitante ou nota interna..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={e => setIsInternal(e.target.checked)}
                            className="rounded"
                          />
                          Nota interna (não visível ao solicitante)
                        </label>
                        <Button size="sm" onClick={submitComment} disabled={submittingComment || !comment.trim()}>
                          {submittingComment ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
