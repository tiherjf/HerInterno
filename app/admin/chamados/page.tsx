"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  User, BarChart2, SlidersHorizontal, ChevronDown, ChevronUp,
  ListChecks, BookOpen, Check, Square, X, Plus, Trash2, RotateCcw,
  UserCheck, GripVertical, List, Columns,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

// ── tipos ──────────────────────────────────────────────────────────────────
interface Ticket {
  id: string; number: number; title: string; priority: string; status: string;
  team: string | null;
  requester_name: string; requester_sector: string | null;
  created_at: string; updated_at: string; sla_deadline: string | null;
  first_response_at: string | null; resolved_at: string | null; rating: number | null;
  solution: string | null;
  ticket_categories: { id: string; name: string; color: string } | null;
  assigned: { id: string; full_name: string } | null;
}

const KANBAN_COLS: { key: string; label: string; header: string; bg: string }[] = [
  { key: "open",        label: "Aberto",          header: "bg-gray-200 text-gray-700",  bg: "bg-gray-50" },
  { key: "in_progress", label: "Em Atendimento",   header: "bg-blue-100 text-blue-800",  bg: "bg-blue-50/40" },
  { key: "resolved",    label: "Resolvido",        header: "bg-green-100 text-green-800",bg: "bg-green-50/40" },
  { key: "closed",      label: "Encerrado",        header: "bg-slate-200 text-slate-700",bg: "bg-slate-50" },
];
interface Comment { id: string; author_name: string; content: string; is_internal: boolean; created_at: string }
interface HistoryEntry { id: string; user_name: string; action: string; old_value: string | null; new_value: string | null; created_at: string }
interface ChecklistItem { id: string; text: string; completed: boolean; completed_at: string | null; completer?: { full_name: string } | null }
interface Template { id: string; name: string; content: string; team: string }
interface AgentUser { id: string; full_name: string; role: string }

type TimelineItem =
  | ({ kind: "comment" } & Comment)
  | ({ kind: "history" } & HistoryEntry);

// ── constantes ─────────────────────────────────────────────────────────────
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
const HISTORY_LABEL: Record<string, (h: HistoryEntry) => string> = {
  status_changed:   h => `Status: ${h.old_value} → ${h.new_value}`,
  assigned:         h => `Atribuído para ${h.new_value}`,
  unassigned:       ()=> `Atribuição removida`,
  reopened:         ()=> `Chamado reaberto`,
  priority_changed: h => `Prioridade: ${h.old_value} → ${h.new_value}`,
};
const TABS = [
  { key: "",            label: "Todos" },
  { key: "unassigned",  label: "Não Atribuídos" },
  { key: "my_assigned", label: "Meus" },
  { key: "resolved",    label: "Resolvidos" },
];
const TEAM_TABS = [
  { key: "",           label: "Todas" },
  { key: "ti",         label: "TI" },
  { key: "manutencao", label: "Manutenção" },
];

// ── SLA chip com alerta visual ──────────────────────────────────────────────
function SlaChip({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline || ["resolved", "closed", "cancelled"].includes(status)) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return (
    <span className="text-xs text-red-600 font-semibold flex items-center gap-0.5 animate-pulse">
      <AlertTriangle size={11} /> Vencido
    </span>
  );
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const urgent = diff < 7200000; // < 2h
  const color = diff < 3600000 ? "text-red-500" : diff < 7200000 ? "text-yellow-600" : "text-green-600";
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${color} ${urgent ? "animate-pulse" : ""}`}>
      <Clock size={11} /> {h > 0 ? `${h}h ${m}m` : `${m}min`}
    </span>
  );
}

// ── componente principal ────────────────────────────────────────────────────
export default function AdminChamadosPage() {
  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("");

  // Modal detalhe
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [detail, setDetail] = useState<{ ticket: Ticket & { description: string; ticket_comments: Comment[]; ticket_history: HistoryEntry[] } } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Atribuição manual
  const [assignToId, setAssignToId] = useState("");
  const [agents, setAgents] = useState<AgentUser[]>([]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplContent, setNewTplContent] = useState("");
  const tplRef = useRef<HTMLDivElement>(null);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);

  // View mode e Kanban
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Modal resolver (campos obrigatórios)
  const [resolveModal, setResolveModal] = useState<Ticket | null>(null);
  const [resolveSolution, setResolveSolution] = useState("");
  const [resolveAssignTo, setResolveAssignTo] = useState("");

  // ── fetch ──────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ view: tab || "all", limit: "200" });
      if (search) p.set("q", search);
      if (filterDateFrom) p.set("date_from", filterDateFrom);
      if (filterDateTo) p.set("date_to", filterDateTo);
      if (filterSector) p.set("sector", filterSector);
      if (filterResponsible) p.set("responsible", filterResponsible);
      const res = await fetch(`/api/chamados?${p}`);
      const json = await res.json();
      setTickets(json.tickets ?? []);
    } finally { setLoading(false); }
  }, [tab, search, filterDateFrom, filterDateTo, filterSector, filterResponsible]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(j => setAgents((j.users ?? []).filter((u: { active: boolean; role: string }) =>
        u.active && ["admin", "ti", "manutencao"].includes(u.role)
      )));
    fetch("/api/chamados/templates")
      .then(r => r.json())
      .then(j => setTemplates(j.templates ?? []));
  }, []);

  // Fecha dropdown de templates ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tplRef.current && !tplRef.current.contains(e.target as Node)) setShowTemplates(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchChecklist = async (ticketId: string) => {
    const res = await fetch(`/api/chamados/${ticketId}/checklist`);
    const json = await res.json();
    setChecklist(json.items ?? []);
  };

  const openDetail = async (t: Ticket) => {
    setSelected(t);
    setDetail(null);
    setComment("");
    setIsInternal(false);
    setAssignToId("");
    setShowTemplates(false);
    setNewChecklistText("");
    setLoadingDetail(true);
    const [detailRes] = await Promise.all([
      fetch(`/api/chamados/${t.id}`).then(r => r.json()),
      fetchChecklist(t.id),
    ]);
    setDetail(detailRes);
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

  const quickStatusChange = async (ticketId: string, status: string) => {
    await fetch(`/api/chamados/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status }),
    });
    fetchTickets();
  };

  const openResolveModal = (ticket: Ticket) => {
    setResolveModal(ticket);
    setResolveSolution("");
    setResolveAssignTo(ticket.assigned?.id ?? "");
  };

  const doResolve = async () => {
    if (!resolveModal || !resolveSolution.trim()) return;
    const assignee = resolveAssignTo || resolveModal.assigned?.id;
    if (!assignee) return;
    setActioning(true);
    const res = await fetch(`/api/chamados/${resolveModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_status", status: "resolved",
        solution: resolveSolution,
        assigned_to: assignee,
      }),
    });
    setActioning(false);
    if (res.ok) {
      setResolveModal(null);
      setResolveSolution("");
      setResolveAssignTo("");
      fetchTickets();
      if (selected?.id === resolveModal.id) {
        const r = await fetch(`/api/chamados/${resolveModal.id}`);
        const json = await r.json();
        setDetail(json);
        setSelected(json.ticket);
      }
    } else {
      const json = await res.json();
      alert(json.error ?? "Erro ao resolver chamado");
    }
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

  const toggleChecklist = async (item: ChecklistItem) => {
    if (!selected) return;
    await fetch(`/api/chamados/${selected.id}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !item.completed }),
    });
    fetchChecklist(selected.id);
  };

  const addChecklistItem = async () => {
    if (!newChecklistText.trim() || !selected) return;
    setAddingChecklist(true);
    await fetch(`/api/chamados/${selected.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newChecklistText }),
    });
    setNewChecklistText("");
    fetchChecklist(selected.id);
    setAddingChecklist(false);
  };

  const deleteChecklistItem = async (itemId: string) => {
    if (!selected) return;
    await fetch(`/api/chamados/${selected.id}/checklist/${itemId}`, { method: "DELETE" });
    fetchChecklist(selected.id);
  };

  const saveTemplate = async () => {
    if (!newTplName.trim() || !newTplContent.trim()) return;
    const res = await fetch("/api/chamados/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTplName, content: newTplContent, team: selected?.team ?? "ti" }),
    });
    if (res.ok) {
      const json = await res.json();
      setTemplates(prev => [...prev, json.template]);
      setNewTplName(""); setNewTplContent(""); setShowNewTemplate(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/chamados/templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const filteredTickets = tickets
    .filter(t => !teamFilter || t.team === teamFilter)
    .filter(t => tab === "resolved" ? ["resolved", "closed"].includes(t.status) : true);

  const activeFilterCount = [filterDateFrom, filterDateTo, filterSector, filterResponsible].filter(Boolean).length;

  // agentes filtrados por equipe do ticket selecionado
  const availableAgents = selected?.team
    ? agents.filter(a => a.role === "admin" || a.role === selected.team)
    : agents;

  // timeline unificada
  const timeline: TimelineItem[] = detail ? [
    ...((detail.ticket.ticket_comments ?? []).map(c => ({ kind: "comment" as const, ...c }))),
    ...((detail.ticket.ticket_history ?? []).map(h => ({ kind: "history" as const, ...h }))),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];

  const checklistDone = checklist.filter(i => i.completed).length;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chamados</h1>
          <p className="text-sm text-muted-foreground">Gestão de solicitações de suporte</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm transition-colors ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <List size={14} /> Lista
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm border-l transition-colors ${viewMode === "kanban" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Columns size={14} /> Kanban
            </button>
          </div>
          <Link href="/admin/chamados/indicadores">
            <Button variant="outline" size="sm"><BarChart2 size={16} /> Indicadores ONA</Button>
          </Link>
        </div>
      </div>

      {/* Filtro de equipe */}
      <div className="flex gap-2">
        {TEAM_TABS.map(t => (
          <button key={t.key} onClick={() => setTeamFilter(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              teamFilter === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Busca + filtros avançados */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
              placeholder="Buscar por título..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={activeFilterCount > 0 ? "border-blue-400 text-blue-700" : ""}>
            <SlidersHorizontal size={14} />
            Filtros{activeFilterCount > 0 && ` (${activeFilterCount})`}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => {
              setFilterDateFrom(""); setFilterDateTo(""); setFilterSector(""); setFilterResponsible("");
            }}>Limpar</Button>
          )}
        </div>

        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">De</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Até</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Setor do solicitante</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: UTI, Recepcão"
                value={filterSector} onChange={e => setFilterSector(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Responsável</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm"
                value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
                <option value="">Todos</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tabela (modo lista) */}
      {viewMode === "list" && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Título</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Categoria</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Equipe</th>
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
                <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum chamado</td></tr>
              ) : filteredTickets.map(t => {
                const slaUrgent = t.sla_deadline && !["resolved","closed","cancelled"].includes(t.status) &&
                  new Date(t.sla_deadline).getTime() - Date.now() < 7200000;
                return (
                  <tr key={t.id} onClick={() => openDetail(t)}
                    className={`cursor-pointer transition-colors ${slaUrgent ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                    style={slaUrgent ? { borderLeft: "3px solid #ef4444" } : undefined}>
                    <td className="px-4 py-3 font-mono text-muted-foreground">#{String(t.number).padStart(4, "0")}</td>
                    <td className="px-4 py-3 max-w-50"><span className="font-medium truncate block">{t.title}</span></td>
                    <td className="px-4 py-3">
                      {t.ticket_categories ? (
                        <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.ticket_categories.color }}>
                          {t.ticket_categories.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.team === "manutencao" ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Manutenção</span>
                        : t.team === "ti" ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">TI</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY[t.priority]?.color}`}>{PRIORITY[t.priority]?.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[t.status]?.color}`}>{STATUS[t.status]?.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{t.requester_name}</div>
                      {t.requester_sector && <div className="text-xs">{t.requester_sector}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {t.assigned ? (
                        <span className="flex items-center gap-1 text-sm"><User size={12} />{t.assigned.full_name}</span>
                      ) : <span className="text-muted-foreground text-xs">Não atribuído</span>}
                    </td>
                    <td className="px-4 py-3"><SlaChip deadline={t.sla_deadline} status={t.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban */}
      {viewMode === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {KANBAN_COLS.map(col => {
              const colTickets = filteredTickets.filter(t =>
                t.status === col.key && t.status !== "cancelled"
              );
              const isOver = dragOverCol === col.key;
              return (
                <div
                  key={col.key}
                  className={`w-72 flex flex-col rounded-xl border-2 transition-colors ${isOver ? "border-blue-400 shadow-lg" : "border-transparent"}`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => {
                    e.preventDefault();
                    if (!dragId) return;
                    const ticket = filteredTickets.find(t => t.id === dragId);
                    if (!ticket || ticket.status === col.key) { setDragId(null); setDragOverCol(null); return; }
                    if (col.key === "resolved") {
                      openResolveModal(ticket);
                    } else {
                      quickStatusChange(dragId, col.key);
                    }
                    setDragId(null);
                    setDragOverCol(null);
                  }}
                >
                  {/* Cabeçalho da coluna */}
                  <div className={`px-4 py-3 rounded-t-xl flex items-center justify-between ${col.header}`}>
                    <span className="font-semibold text-sm">{col.label}</span>
                    <span className="text-xs font-bold bg-white/60 rounded-full px-2 py-0.5">{colTickets.length}</span>
                  </div>

                  {/* Cards */}
                  <div className={`flex-1 p-2 space-y-2 min-h-32 rounded-b-xl ${col.bg}`}>
                    {loading ? (
                      <div className="text-xs text-center text-muted-foreground py-4">Carregando...</div>
                    ) : colTickets.length === 0 ? (
                      <div className={`text-xs text-center text-muted-foreground py-4 rounded-lg border-2 border-dashed transition-colors ${isOver ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                        {isOver ? "Soltar aqui" : "Sem chamados"}
                      </div>
                    ) : colTickets.map(t => {
                      const slaUrgent = t.sla_deadline && !["resolved","closed","cancelled"].includes(t.status) &&
                        new Date(t.sla_deadline).getTime() - Date.now() < 7200000;
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                          onClick={() => openDetail(t)}
                          className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none ${
                            dragId === t.id ? "opacity-40" : ""
                          } ${slaUrgent ? "border-l-4 border-l-red-400" : ""}`}
                        >
                          {/* Topo: número + drag handle */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs text-muted-foreground">#{String(t.number).padStart(4,"0")}</span>
                            <GripVertical size={14} className="text-gray-300" />
                          </div>

                          {/* Título */}
                          <p className="text-sm font-medium leading-snug mb-2 line-clamp-2">{t.title}</p>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY[t.priority]?.color}`}>
                              {PRIORITY[t.priority]?.label}
                            </span>
                            {t.ticket_categories && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: t.ticket_categories.color }}>
                                {t.ticket_categories.name}
                              </span>
                            )}
                          </div>

                          {/* Solicitante */}
                          <p className="text-xs text-muted-foreground truncate">{t.requester_name}{t.requester_sector ? ` · ${t.requester_sector}` : ""}</p>

                          {/* Responsável + SLA */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User size={10} />
                              {t.assigned?.full_name ?? <span className="text-orange-500">Não atribuído</span>}
                            </span>
                            <SlaChip deadline={t.sla_deadline} status={t.status} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

              {/* Atribuição manual */}
              {["open","in_progress"].includes(selected.status) && (
                <div className="flex gap-2 items-center border rounded-lg px-3 py-2 bg-gray-50">
                  <UserCheck size={15} className="text-gray-500 shrink-0" />
                  <select className="flex-1 text-sm border-0 bg-transparent focus:outline-none"
                    value={assignToId} onChange={e => setAssignToId(e.target.value)}>
                    <option value="">Atribuir para...</option>
                    {availableAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                  <Button size="sm" disabled={!assignToId || actioning}
                    onClick={() => { doAction("assign", { assigned_to: assignToId }); setAssignToId(""); }}>
                    Atribuir
                  </Button>
                </div>
              )}

              {/* Ações rápidas */}
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                {selected.status === "open" && (
                  <Button size="sm" onClick={() => doAction("set_status", { status: "in_progress" })} disabled={actioning}>
                    <RefreshCw size={14} /> Iniciar Atendimento
                  </Button>
                )}
                {selected.status === "in_progress" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => openResolveModal(selected)} disabled={actioning}>
                    <CheckCircle2 size={14} /> Resolver
                  </Button>
                )}
                {["open","in_progress"].includes(selected.status) && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200"
                    onClick={() => doAction("set_status", { status: "cancelled" })} disabled={actioning}>
                    <XCircle size={14} /> Cancelar
                  </Button>
                )}
                {selected.status === "resolved" && (
                  <Button size="sm" variant="outline"
                    onClick={() => doAction("set_status", { status: "closed" })} disabled={actioning}>
                    <CheckCircle2 size={14} /> Encerrar
                  </Button>
                )}
                {["resolved","closed"].includes(selected.status) && (
                  <Button size="sm" variant="outline"
                    onClick={() => doAction("reopen")} disabled={actioning}>
                    <RotateCcw size={14} /> Reabrir
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
                      <span className="text-xs px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: selected.ticket_categories.color }}>
                        {selected.ticket_categories.name}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY[selected.priority]?.color}`}>
                      {PRIORITY[selected.priority]?.label}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS[selected.status]?.color}`}>
                      {STATUS[selected.status]?.label}
                    </span>
                    {selected.assigned && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 flex items-center gap-1">
                        <User size={11} />{selected.assigned.full_name}
                      </span>
                    )}
                    <SlaChip deadline={selected.sla_deadline} status={selected.status} />
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Solicitante: <strong className="text-gray-700">{selected.requester_name}</strong>
                      {selected.requester_sector && ` (${selected.requester_sector})`}</div>
                    <div>Abertura: <strong className="text-gray-700">{formatDate(selected.created_at)}</strong></div>
                    {selected.first_response_at && (
                      <div>1ª resposta: <strong className="text-gray-700">{formatDate(selected.first_response_at)}</strong></div>
                    )}
                    {selected.resolved_at && (
                      <div>Resolvido: <strong className="text-gray-700">{formatDate(selected.resolved_at)}</strong></div>
                    )}
                    {selected.rating && (
                      <div>Avaliação: <strong className="text-yellow-500">{"★".repeat(selected.rating)}{"☆".repeat(5-selected.rating)}</strong></div>
                    )}
                  </div>

                  {/* Descrição */}
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">{detail.ticket.description}</div>

                  {/* Solução */}
                  {detail.ticket.solution && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> Solução aplicada</p>
                      <p className="text-sm whitespace-pre-wrap text-gray-700">{detail.ticket.solution}</p>
                    </div>
                  )}

                  {/* Timeline unificada */}
                  {timeline.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Histórico</p>
                      {timeline.map(item =>
                        item.kind === "comment" ? (
                          <div key={item.id}
                            className={`rounded-lg p-3 text-sm ${item.is_internal ? "bg-amber-50 border border-amber-200" : "bg-blue-50"}`}>
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{item.author_name}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-gray-700">{item.content}</p>
                            {item.is_internal && <span className="text-xs text-amber-600 mt-1 block">Nota interna</span>}
                          </div>
                        ) : (
                          <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            <span className="text-gray-500">{HISTORY_LABEL[item.action]?.(item) ?? item.action}</span>
                            <span className="ml-auto">{item.user_name} · {formatDate(item.created_at)}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Checklist */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <ListChecks size={15} />
                        Checklist
                        {checklist.length > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            checklistDone === checklist.length ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                          }`}>{checklistDone}/{checklist.length}</span>
                        )}
                      </span>
                    </div>
                    {checklist.length === 0 && (
                      <p className="text-xs text-muted-foreground px-4 py-2">Nenhuma tarefa adicionada</p>
                    )}
                    <div className="divide-y">
                      {checklist.map(item => (
                        <div key={item.id} className={`flex items-center gap-3 px-4 py-2 ${item.completed ? "bg-gray-50" : ""}`}>
                          <button onClick={() => toggleChecklist(item)}
                            className={`shrink-0 ${item.completed ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}>
                            {item.completed ? <Check size={16} /> : <Square size={16} />}
                          </button>
                          <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                            {item.text}
                          </span>
                          {item.completed && item.completer && (
                            <span className="text-xs text-muted-foreground">{item.completer.full_name}</span>
                          )}
                          <button onClick={() => deleteChecklistItem(item.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-2 border-t bg-gray-50">
                      <input
                        className="flex-1 text-sm border rounded px-2 py-1.5"
                        placeholder="Adicionar tarefa..."
                        value={newChecklistText}
                        onChange={e => setNewChecklistText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addChecklistItem(); }}
                      />
                      <Button size="sm" onClick={addChecklistItem}
                        disabled={!newChecklistText.trim() || addingChecklist}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Adicionar atualização */}
                  {!["cancelled"].includes(selected.status) && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium">Adicionar atualização</label>
                        {/* Templates dropdown */}
                        <div className="relative" ref={tplRef}>
                          <Button size="sm" variant="ghost" onClick={() => setShowTemplates(!showTemplates)}
                            className="text-xs gap-1">
                            <BookOpen size={13} /> Templates <ChevronDown size={11} />
                          </Button>
                          {showTemplates && (
                            <div className="absolute right-0 top-8 z-20 bg-white border rounded-lg shadow-lg w-72 max-h-64 overflow-y-auto">
                              {templates.filter(t => !selected.team || t.team === selected.team).map(t => (
                                <button key={t.id}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0 group"
                                  onClick={() => { setComment(t.content); setShowTemplates(false); }}>
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{t.name}</span>
                                    <button onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }}
                                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.content}</p>
                                </button>
                              ))}
                              <button
                                onClick={() => { setShowNewTemplate(true); setShowTemplates(false); }}
                                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1 border-t">
                                <Plus size={12} /> Criar novo template
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                        rows={3}
                        placeholder="Resposta ao solicitante ou nota interna..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer">
                          <input type="checkbox" checked={isInternal}
                            onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                          Nota interna
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

      {/* Modal Resolver — campos obrigatórios */}
      <Dialog open={!!resolveModal} onOpenChange={v => { if (!v) { setResolveModal(null); setResolveSolution(""); setResolveAssignTo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" />
              Resolver #{resolveModal && String(resolveModal.number).padStart(4, "0")}
            </DialogTitle>
          </DialogHeader>
          {resolveModal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Preencha os campos obrigatórios antes de marcar como resolvido.</p>

              {/* Atribuição — obrigatória se não atribuído */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <UserCheck size={14} /> Responsável *
                </label>
                <select
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  value={resolveAssignTo}
                  onChange={e => setResolveAssignTo(e.target.value)}
                >
                  <option value="">Selecionar responsável...</option>
                  {(resolveModal.team ? agents.filter(a => a.role === "admin" || a.role === resolveModal.team) : agents).map(a => (
                    <option key={a.id} value={a.id}>{a.full_name}</option>
                  ))}
                </select>
                {!resolveAssignTo && !resolveModal.assigned && (
                  <p className="text-xs text-red-500 mt-1">Obrigatório para resolver</p>
                )}
              </div>

              {/* Solução — obrigatória */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <CheckCircle2 size={14} /> Solução aplicada *
                </label>
                <textarea
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none"
                  rows={4}
                  placeholder="Descreva o que foi feito para resolver o chamado..."
                  value={resolveSolution}
                  onChange={e => setResolveSolution(e.target.value)}
                  autoFocus
                />
                {!resolveSolution.trim() && (
                  <p className="text-xs text-red-500 mt-1">Obrigatório para resolver</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setResolveModal(null); setResolveSolution(""); setResolveAssignTo(""); }}>
                  Cancelar
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!resolveSolution.trim() || (!resolveAssignTo && !resolveModal.assigned) || actioning}
                  onClick={doResolve}
                >
                  <CheckCircle2 size={14} /> {actioning ? "Resolvendo..." : "Marcar como Resolvido"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal novo template */}
      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Aguardando peça" value={newTplName} onChange={e => setNewTplName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <textarea className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none" rows={4}
                placeholder="Texto da resposta padrão..." value={newTplContent} onChange={e => setNewTplContent(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewTemplate(false)}>Cancelar</Button>
              <Button onClick={saveTemplate} disabled={!newTplName.trim() || !newTplContent.trim()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
