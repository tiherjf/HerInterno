"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  User, BarChart2, SlidersHorizontal, ChevronDown, ChevronUp,
  ListChecks, BookOpen, Check, Square, X, Plus, Trash2, RotateCcw,
  UserCheck, GripVertical, List, Columns, Tag,
  Loader2, Hourglass, Users, Wrench, History,
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
  equipment_patrimonio?: string | null;
  ticket_categories: { id: string; name: string; color: string } | null;
  assigned: { id: string; full_name: string } | null;
}

const KANBAN_COLS: { key: string; label: string; header: string; bg: string }[] = [
  { key: "open",         label: "Aberto",             header: "bg-gray-200 text-gray-700",  bg: "bg-gray-50" },
  { key: "in_progress",  label: "Em Atendimento",      header: "bg-blue-100 text-blue-800",  bg: "bg-blue-50/40" },
  { key: "waiting_user", label: "Aguardando Usuário",  header: "bg-amber-100 text-amber-800",bg: "bg-amber-50/40" },
  { key: "waiting_third_party", label: "Aguardando Terceiros", header: "bg-orange-100 text-orange-800", bg: "bg-orange-50/40" },
  { key: "resolved",     label: "Resolvido",           header: "bg-green-100 text-green-800",bg: "bg-green-50/40" },
  { key: "closed",       label: "Encerrado",           header: "bg-slate-200 text-slate-700",bg: "bg-slate-50" },
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
  scheduled: { label: "A Programar", color: "bg-gray-200 text-gray-600" },
};
// Cor sólida do "ponto" de prioridade usado na barra lateral do detalhe
const PRIORITY_DOT: Record<string, string> = {
  low:       "bg-blue-500",
  medium:    "bg-yellow-500",
  high:      "bg-orange-500",
  critical:  "bg-red-500",
  scheduled: "bg-gray-400",
};
const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: "Aberto",         color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "Em Atendimento", color: "bg-blue-100 text-blue-700" },
  waiting_user: { label: "Aguardando Usuário", color: "bg-amber-100 text-amber-700" },
  waiting_third_party: { label: "Aguardando Terceiros", color: "bg-orange-100 text-orange-700" },
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
  { key: "marketing",  label: "MKT" },
];

// ── SLA chip com alerta visual ──────────────────────────────────────────────
function SlaChip({ deadline, status }: { deadline: string | null; status: string }) {
  if (status === "waiting_user" || status === "waiting_third_party") return (
    <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
      <Hourglass size={11} /> SLA pausado
    </span>
  );
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

// ── Card de destaque do SLA (usado no painel de detalhe) ─────────────────────
// Reaproveita exatamente a mesma lógica de prazo do SlaChip (calculada a partir
// de sla_deadline) — apenas apresentada como um cartão colorido maior.
function SlaCard({ deadline, status, breachReason }: { deadline: string | null; status: string; breachReason?: string | null }) {
  // SLA pausado enquanto aguarda usuário/terceiros
  if (status === "waiting_user" || status === "waiting_third_party") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
        <Hourglass size={16} className="text-amber-600 shrink-0" />
        <span className="text-sm font-medium text-amber-700">SLA pausado</span>
        <span className="text-xs text-amber-600 ml-auto">Contagem retomada ao voltar o atendimento</span>
      </div>
    );
  }

  const finalized = ["resolved", "closed", "cancelled"].includes(status);

  // Chamado finalizado com estouro de prazo → painel vermelho com o motivo
  if (finalized) {
    if (breachReason) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
            <AlertTriangle size={13} /> SLA estourado — motivo:
          </p>
          <p className="text-sm whitespace-pre-wrap text-gray-700">{breachReason}</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
        <CheckCircle2 size={16} className="text-green-600 shrink-0" />
        <span className="text-sm font-medium text-green-700">SLA cumprido</span>
      </div>
    );
  }

  if (!deadline) return null;

  const diff = new Date(deadline).getTime() - Date.now();

  // Vencido
  if (diff <= 0) {
    const over = -diff;
    const h = Math.floor(over / 3600000);
    const m = Math.floor((over % 3600000) / 60000);
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-2 animate-pulse">
        <AlertTriangle size={16} className="text-red-600 shrink-0" />
        <span className="text-sm font-semibold text-red-700">SLA vencido</span>
        <span className="text-xs text-red-600 ml-auto font-medium">vencido há {h > 0 ? `${h}h ${m}m` : `${m}min`}</span>
      </div>
    );
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const remaining = h > 0 ? `${h}h ${m}m` : `${m}min`;
  const urgent = diff < 7200000; // < 2h

  if (urgent) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-2 animate-pulse">
        <Clock size={16} className="text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-700">SLA vence em breve</span>
        <span className="text-xs text-amber-600 ml-auto font-medium">faltam {remaining}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
      <Clock size={16} className="text-green-600 shrink-0" />
      <span className="text-sm font-semibold text-green-700">Dentro do prazo</span>
      <span className="text-xs text-green-600 ml-auto font-medium">faltam {remaining}</span>
    </div>
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
  const [detail, setDetail] = useState<{ ticket: Ticket & { description: string; materials?: string | null; cost?: number | null; sla_breach_reason?: string | null; ticket_comments: Comment[]; ticket_history: HistoryEntry[] } } | null>(null);
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
  // Materiais e custo (manutenção) — opcionais ao resolver
  const [resolveMaterials, setResolveMaterials] = useState("");
  const [resolveCost, setResolveCost] = useState("");
  // Motivo do estouro de SLA — obrigatório ao resolver chamado com prazo vencido
  const [resolveBreachReason, setResolveBreachReason] = useState("");
  const [resolveError, setResolveError] = useState("");

  // Histórico de chamados do mesmo patrimônio (manutenção)
  const [patrHistory, setPatrHistory] = useState<Ticket[]>([]);
  const [showPatrHistory, setShowPatrHistory] = useState(false);

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
        u.active && ["admin", "ti", "manutencao", "marketing"].includes(u.role)
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
    const patchRes = await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setActioning(false);
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => null);
      alert(err?.error ?? "Erro ao atualizar o chamado");
      return;
    }
    fetchTickets();
    const res = await fetch(`/api/chamados/${selected.id}`);
    const json = await res.json();
    setDetail(json);
    setSelected(json.ticket);
  };

  // Histórico do equipamento (patrimônio): melhor esforço — oculta em caso de erro
  useEffect(() => {
    const patr = detail?.ticket?.equipment_patrimonio;
    const ticketId = detail?.ticket?.id;
    setPatrHistory([]);
    setShowPatrHistory(false);
    if (!patr || !ticketId) return;
    let active = true;
    fetch(`/api/chamados?view=all&patrimonio=${encodeURIComponent(patr)}&limit=10`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!active || !j) return;
        setPatrHistory(((j.tickets ?? []) as Ticket[]).filter(t => t.id !== ticketId));
      })
      .catch(() => { /* melhor esforço */ });
    return () => { active = false; };
  }, [detail?.ticket?.id, detail?.ticket?.equipment_patrimonio]);

  const quickStatusChange = async (ticketId: string, status: string) => {
    const res = await fetch(`/api/chamados/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.error ?? "Erro ao atualizar status");
    }
    fetchTickets();
  };

  const openResolveModal = (ticket: Ticket) => {
    setResolveModal(ticket);
    setResolveSolution("");
    setResolveAssignTo(ticket.assigned?.id ?? "");
    setResolveMaterials("");
    setResolveCost("");
    setResolveBreachReason("");
    setResolveError("");
  };

  const closeResolveModal = () => {
    setResolveModal(null);
    setResolveSolution("");
    setResolveAssignTo("");
    setResolveMaterials("");
    setResolveCost("");
    setResolveBreachReason("");
    setResolveError("");
  };

  // SLA vencido no momento da resolução → motivo do estouro é obrigatório
  const resolveSlaBreached = !!(resolveModal?.sla_deadline &&
    new Date(resolveModal.sla_deadline).getTime() < Date.now());

  const doResolve = async () => {
    if (!resolveModal || !resolveSolution.trim()) return;
    const assignee = resolveAssignTo || resolveModal.assigned?.id;
    if (!assignee) return;
    if (resolveSlaBreached && !resolveBreachReason.trim()) return;
    const isManutencao = resolveModal.team === "manutencao";
    setResolveError("");
    setActioning(true);
    const res = await fetch(`/api/chamados/${resolveModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_status", status: "resolved",
        solution: resolveSolution,
        assigned_to: assignee,
        materials: isManutencao && resolveMaterials.trim() ? resolveMaterials.trim() : undefined,
        cost: isManutencao && resolveCost !== "" ? Number(resolveCost) : undefined,
        sla_breach_reason: resolveSlaBreached && resolveBreachReason.trim()
          ? resolveBreachReason.trim().slice(0, 1000)
          : undefined,
      }),
    });
    setActioning(false);
    const json = await res.json().catch(() => null);
    if (res.ok) {
      if (json?.aviso) alert(json.aviso);
      const resolvedId = resolveModal.id;
      closeResolveModal();
      fetchTickets();
      if (selected?.id === resolvedId) {
        const r = await fetch(`/api/chamados/${resolvedId}`);
        const detailJson = await r.json();
        setDetail(detailJson);
        setSelected(detailJson.ticket);
      }
    } else {
      setResolveError(json?.error ?? "Erro ao resolver chamado");
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
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              className="rounded-none gap-1.5"
            >
              <List size={14} /> Lista
            </Button>
            <Button
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              onClick={() => setViewMode("kanban")}
              className="rounded-none border-l gap-1.5"
            >
              <Columns size={14} /> Kanban
            </Button>
          </div>
          <Link href="/admin/chamados/categorias">
            <Button variant="outline" size="sm"><Tag size={16} /> Categorias &amp; SLA</Button>
          </Link>
          <Link href="/admin/chamados/indicadores">
            <Button variant="outline" size="sm"><BarChart2 size={16} /> Indicadores ONA</Button>
          </Link>
        </div>
      </div>

      {/* Filtro de equipe */}
      <div className="flex gap-2 flex-wrap">
        {TEAM_TABS.map(t => (
          <Button
            key={t.key}
            size="sm"
            variant={teamFilter === t.key ? "default" : "outline"}
            onClick={() => setTeamFilter(t.key)}
            className="rounded-full"
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Busca + filtros avançados */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Buscar por título, descrição, nº ou protocolo..."
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
          <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Setor do solicitante</Label>
              <Input placeholder="Ex: UTI, Recepção" value={filterSector} onChange={e => setFilterSector(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Select value={filterResponsible || "__all__"} onValueChange={v => setFilterResponsible(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
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
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: t.ticket_categories.color }}>
                          {t.ticket_categories.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {t.team === "manutencao" ? <Badge className="text-xs bg-orange-100 text-orange-700 border-0">Manutenção</Badge>
                        : t.team === "ti" ? <Badge className="text-xs bg-blue-100 text-blue-700 border-0">TI</Badge>
                        : t.team === "marketing" ? <Badge className="text-xs bg-pink-100 text-pink-700 border-0">MKT</Badge>
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border-0 ${PRIORITY[t.priority]?.color}`}>{PRIORITY[t.priority]?.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border-0 ${STATUS[t.status]?.color}`}>{STATUS[t.status]?.label}</Badge>
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

      {/* Painel de detalhe — slide-over à direita */}
      <Sheet open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setDetail(null); } }}>
        <SheetContent side="right" className="w-full max-w-2xl sm:max-w-2xl p-0 flex flex-col gap-0">
          {selected && (
            <>
              {/* Cabeçalho fixo */}
              <div className="flex items-center gap-3 border-b px-5 py-3.5 pr-12 shrink-0">
                <span className="font-mono text-sm text-muted-foreground shrink-0">#{String(selected.number).padStart(4,"0")}</span>
                <SheetTitle className="flex-1 truncate text-base font-bold leading-tight">{selected.title}</SheetTitle>
                <Badge className={`text-xs border-0 shrink-0 ${STATUS[selected.status]?.color}`}>
                  {STATUS[selected.status]?.label}
                </Badge>
              </div>

              {/* Corpo rolável — duas colunas no desktop */}
              <div className="flex-1 overflow-y-auto">
                {loadingDetail ? (
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-16" />
                  </div>
                ) : detail ? (
                  <div className="grid md:grid-cols-3 md:divide-x">
                    {/* Coluna principal */}
                    <div className="md:col-span-2 p-5 space-y-5 min-w-0">
                      {/* SLA em destaque */}
                      <SlaCard
                        deadline={selected.sla_deadline}
                        status={selected.status}
                        breachReason={detail.ticket.sla_breach_reason}
                      />

                      {/* Descrição */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Descrição</p>
                        <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-700">{detail.ticket.description}</div>
                      </div>

                      {/* Solução */}
                      {detail.ticket.solution && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> Solução aplicada</p>
                          <p className="text-sm whitespace-pre-wrap text-gray-700">{detail.ticket.solution}</p>
                        </div>
                      )}

                      {/* Materiais e custo (manutenção) */}
                      {(detail.ticket.materials || detail.ticket.cost != null) && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                          {detail.ticket.materials && (
                            <div>
                              <p className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1"><Wrench size={12} /> Materiais utilizados</p>
                              <p className="text-sm whitespace-pre-wrap text-gray-700">{detail.ticket.materials}</p>
                            </div>
                          )}
                          {detail.ticket.cost != null && (
                            <p className="text-sm text-gray-700">
                              <span className="text-xs font-bold text-orange-700">Custo:</span>{" "}
                              {Number(detail.ticket.cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Conversa & Histórico — timeline unificada */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Conversa &amp; Histórico</p>
                        {timeline.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma atualização ainda</p>
                        ) : (
                          <div className="space-y-3">
                            {timeline.map(item =>
                              item.kind === "comment" ? (
                                <div key={item.id}
                                  className={`rounded-lg p-3 text-sm ${item.is_internal ? "bg-amber-50 border-l-4 border-amber-400" : "bg-blue-50 border border-blue-100"}`}>
                                  <div className="flex justify-between mb-1">
                                    <span className="font-medium">{item.author_name}</span>
                                    <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-gray-700">{item.content}</p>
                                  {item.is_internal && <span className="text-xs text-amber-600 mt-1 block font-medium">Nota interna</span>}
                                </div>
                              ) : (
                                <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                  <span className="text-gray-500">{HISTORY_LABEL[item.action]?.(item) ?? item.action}</span>
                                  <span className="ml-auto text-right">{item.user_name} · {formatDate(item.created_at)}</span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      {/* Adicionar atualização */}
                      {!["cancelled"].includes(selected.status) && (
                        <div className="border-t pt-4">
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
                          <Textarea
                            rows={3}
                            placeholder="Resposta ao solicitante ou nota interna..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            className="resize-none"
                          />
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="is_internal"
                                checked={isInternal}
                                onCheckedChange={v => setIsInternal(v === true)}
                                className="border-amber-600 data-[state=checked]:bg-amber-600"
                              />
                              <Label htmlFor="is_internal" className="text-sm text-amber-700 cursor-pointer">
                                Nota interna
                              </Label>
                            </div>
                            <Button size="sm" onClick={submitComment} disabled={submittingComment || !comment.trim()}>
                              {submittingComment ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : "Enviar"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Coluna lateral — metadados */}
                    <div className="md:col-span-1 p-5 space-y-4 bg-muted/20 border-t md:border-t-0">
                      {/* Metadados */}
                      <div className="rounded-lg border bg-white divide-y">
                        {/* Prioridade */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prioridade</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-sm">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[selected.priority] ?? "bg-gray-300"}`} />
                            {PRIORITY[selected.priority]?.label ?? selected.priority}
                          </div>
                        </div>
                        {/* Categoria */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</p>
                          <div className="mt-0.5 text-sm">
                            {selected.ticket_categories ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full text-white font-medium"
                                style={{ backgroundColor: selected.ticket_categories.color }}>
                                {selected.ticket_categories.name}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                        {/* Responsável */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</p>
                          <div className="mt-0.5 text-sm flex items-center gap-1">
                            {selected.assigned ? (
                              <><User size={12} className="text-muted-foreground" />{selected.assigned.full_name}</>
                            ) : <span className="text-muted-foreground">Não atribuído</span>}
                          </div>
                        </div>
                        {/* Solicitante */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Solicitante</p>
                          <div className="mt-0.5 text-sm">
                            {selected.requester_name}
                            {selected.requester_sector && (
                              <span className="block text-xs text-muted-foreground">{selected.requester_sector}</span>
                            )}
                          </div>
                        </div>
                        {/* Abertura */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Abertura</p>
                          <div className="mt-0.5 text-sm">{formatDate(selected.created_at)}</div>
                        </div>
                        {/* 1ª resposta */}
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">1ª resposta</p>
                          <div className="mt-0.5 text-sm">
                            {selected.first_response_at ? formatDate(selected.first_response_at) : <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                        {/* Resolvido */}
                        {selected.resolved_at && (
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resolvido</p>
                            <div className="mt-0.5 text-sm">{formatDate(selected.resolved_at)}</div>
                          </div>
                        )}
                        {/* Avaliação */}
                        {selected.rating && (
                          <div className="px-3 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Avaliação</p>
                            <div className="mt-0.5 text-sm text-yellow-500">{"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}</div>
                          </div>
                        )}
                      </div>

                      {/* Checklist */}
                      <div className="border rounded-lg overflow-hidden bg-white">
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
                        <div className="flex gap-2 px-4 py-2 border-t bg-muted/30">
                          <Input
                            className="flex-1 h-8 text-sm"
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

                      {/* Histórico do equipamento (patrimônio) */}
                      {detail.ticket.equipment_patrimonio && patrHistory.length > 0 && (
                        <div className="border rounded-lg overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => setShowPatrHistory(v => !v)}
                            className="w-full flex items-center justify-between bg-gray-50 px-4 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors text-left"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <History size={15} className="shrink-0" />
                              <span className="truncate">Histórico deste equipamento ({patrHistory.length})</span>
                            </span>
                            {showPatrHistory ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                          </button>
                          {showPatrHistory && (
                            <div className="divide-y">
                              <div className="px-4 py-1.5 font-mono text-xs text-muted-foreground bg-gray-50/50">Pat. {detail.ticket.equipment_patrimonio}</div>
                              {patrHistory.map(t => (
                                <div key={t.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                                  <span className="font-mono text-xs text-muted-foreground shrink-0">#{String(t.number).padStart(4, "0")}</span>
                                  <span className="flex-1 truncate">{t.title}</span>
                                  <Badge className={`text-xs border-0 shrink-0 ${STATUS[t.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                                    {STATUS[t.status]?.label ?? t.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Barra de ações fixa (rodapé) */}
              <div className="border-t bg-background px-5 py-3 shrink-0 space-y-2">
                {/* Atribuição manual */}
                {["open","in_progress","waiting_user","waiting_third_party"].includes(selected.status) && (
                  <div className="flex gap-2 items-center border rounded-lg px-3 py-1.5 bg-muted/50">
                    <UserCheck size={15} className="text-muted-foreground shrink-0" />
                    <Select value={assignToId || "__none__"} onValueChange={v => setAssignToId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="flex-1 border-0 bg-transparent h-8 shadow-none focus:ring-0 text-sm">
                        <SelectValue placeholder="Atribuir para..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Atribuir para...</SelectItem>
                        {availableAgents.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={!assignToId || actioning}
                      onClick={() => { doAction("assign", { assigned_to: assignToId }); setAssignToId(""); }}>
                      Atribuir
                    </Button>
                  </div>
                )}

                {/* Ações rápidas */}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "open" && (
                    <Button size="sm" onClick={() => doAction("set_status", { status: "in_progress" })} disabled={actioning}>
                      <RefreshCw size={14} /> Iniciar Atendimento
                    </Button>
                  )}
                  {selected.status === "in_progress" && (
                    <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50"
                      onClick={() => doAction("set_status", { status: "waiting_user" })} disabled={actioning}>
                      <Hourglass size={14} /> Aguardar Usuário
                    </Button>
                  )}
                  {["open","in_progress","waiting_user"].includes(selected.status) && (
                    <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-50"
                      onClick={() => doAction("set_status", { status: "waiting_third_party" })} disabled={actioning}>
                      <Users size={14} /> Aguardar Terceiros
                    </Button>
                  )}
                  {["waiting_user","waiting_third_party"].includes(selected.status) && (
                    <Button size="sm" onClick={() => doAction("set_status", { status: "in_progress" })} disabled={actioning}>
                      <RefreshCw size={14} /> Retomar Atendimento
                    </Button>
                  )}
                  {["in_progress","waiting_user","waiting_third_party"].includes(selected.status) && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"
                      onClick={() => openResolveModal(selected)} disabled={actioning}>
                      <CheckCircle2 size={14} /> Resolver
                    </Button>
                  )}
                  {["open","in_progress","waiting_user","waiting_third_party"].includes(selected.status) && (
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Resolver — campos obrigatórios */}
      <Dialog open={!!resolveModal} onOpenChange={v => { if (!v) closeResolveModal(); }}>
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

              {resolveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* Atribuição — obrigatória se não atribuído */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <UserCheck size={14} /> Responsável *
                </Label>
                <Select value={resolveAssignTo || "__none__"} onValueChange={v => setResolveAssignTo(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecionar responsável...</SelectItem>
                    {(resolveModal.team ? agents.filter(a => a.role === "admin" || a.role === resolveModal.team) : agents).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!resolveAssignTo && !resolveModal.assigned && (
                  <p className="text-xs text-destructive">Obrigatório para resolver</p>
                )}
              </div>

              {/* Solução — obrigatória */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <CheckCircle2 size={14} /> Solução aplicada *
                </Label>
                <Textarea
                  rows={4}
                  placeholder="Descreva o que foi feito para resolver o chamado..."
                  value={resolveSolution}
                  onChange={e => setResolveSolution(e.target.value)}
                  autoFocus
                  className="resize-none"
                />
                {!resolveSolution.trim() && (
                  <p className="text-xs text-destructive">Obrigatório para resolver</p>
                )}
              </div>

              {/* Motivo do estouro de SLA — obrigatório quando o prazo já venceu */}
              {resolveSlaBreached && (
                <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
                  <Label className="flex items-center gap-1 text-red-700">
                    <AlertTriangle size={14} /> Motivo do estouro do SLA *
                  </Label>
                  <p className="text-xs text-red-600">
                    O prazo de SLA deste chamado já venceu. Informe o motivo do estouro para registrar a resolução.
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="Ex: aguardando peça do fornecedor, indisponibilidade do setor..."
                    value={resolveBreachReason}
                    onChange={e => setResolveBreachReason(e.target.value)}
                    maxLength={1000}
                    className="resize-none bg-white"
                  />
                  {!resolveBreachReason.trim() && (
                    <p className="text-xs text-destructive">Obrigatório para resolver chamado com SLA vencido</p>
                  )}
                </div>
              )}

              {/* Materiais e custo — apenas manutenção, opcionais */}
              {resolveModal.team === "manutencao" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Wrench size={14} /> Materiais utilizados
                      <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Ex: 2m de fio 2,5mm, 1 disjuntor 20A..."
                      value={resolveMaterials}
                      onChange={e => setResolveMaterials(e.target.value)}
                      maxLength={2000}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Custo (R$) <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={resolveCost}
                      onChange={e => setResolveCost(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeResolveModal}>
                  Cancelar
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!resolveSolution.trim() || (!resolveAssignTo && !resolveModal.assigned) || (resolveSlaBreached && !resolveBreachReason.trim()) || actioning}
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
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Ex: Aguardando peça" value={newTplName} onChange={e => setNewTplName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea rows={4} placeholder="Texto da resposta padrão..." value={newTplContent} onChange={e => setNewTplContent(e.target.value)} className="resize-none" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewTemplate(false)}>Cancelar</Button>
              <Button onClick={saveTemplate} disabled={!newTplName.trim() || !newTplContent.trim()}>Salvar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
