"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle,
  User, BarChart2, SlidersHorizontal, ChevronDown, ChevronUp,
  ListChecks, BookOpen, Check, Square, X, Plus, Trash2, RotateCcw,
  UserCheck, GripVertical, List, Columns, Tag, Pencil, ToggleLeft, ToggleRight,
  Loader2, Hourglass, Wrench, History,
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
  { key: "resolved",     label: "Resolvido",           header: "bg-green-100 text-green-800",bg: "bg-green-50/40" },
  { key: "closed",       label: "Encerrado",           header: "bg-slate-200 text-slate-700",bg: "bg-slate-50" },
];
interface Comment { id: string; author_name: string; content: string; is_internal: boolean; created_at: string }
interface HistoryEntry { id: string; user_name: string; action: string; old_value: string | null; new_value: string | null; created_at: string }
interface ChecklistItem { id: string; text: string; completed: boolean; completed_at: string | null; completer?: { full_name: string } | null }
interface Template { id: string; name: string; content: string; team: string }
interface AgentUser { id: string; full_name: string; role: string }
interface Category {
  id: string; name: string; color: string; sla_hours: number;
  team: string; default_priority: string | null; active: boolean;
}

const EMPTY_CAT = { name: "", color: "#3b82f6", sla_hours: "24", team: "ti", default_priority: "" };

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
  waiting_user: { label: "Aguardando Usuário", color: "bg-amber-100 text-amber-700" },
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
  { key: "categorias",  label: "Categorias" },
];
const TEAM_TABS = [
  { key: "",           label: "Todas" },
  { key: "ti",         label: "TI" },
  { key: "manutencao", label: "Manutenção" },
  { key: "marketing",  label: "MKT" },
];

// ── SLA chip com alerta visual ──────────────────────────────────────────────
function SlaChip({ deadline, status }: { deadline: string | null; status: string }) {
  if (status === "waiting_user") return (
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
  const [detail, setDetail] = useState<{ ticket: Ticket & { description: string; materials?: string | null; cost?: number | null; ticket_comments: Comment[]; ticket_history: HistoryEntry[] } } | null>(null);
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

  // Gestão de categorias
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [savingCat, setSavingCat] = useState(false);

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

  const fetchCategories = useCallback(async () => {
    setLoadingCats(true);
    const res = await fetch("/api/chamados/categorias?all=true");
    const json = await res.json();
    setCategories(json.categories ?? []);
    setLoadingCats(false);
  }, []);

  useEffect(() => {
    if (tab === "categorias") fetchCategories();
  }, [tab, fetchCategories]);

  const openCreateCat = () => {
    setEditingCatId(null);
    setCatForm(EMPTY_CAT);
    setShowCatForm(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatForm({
      name: cat.name,
      color: cat.color,
      sla_hours: String(cat.sla_hours),
      team: cat.team,
      default_priority: cat.default_priority ?? "",
    });
    setShowCatForm(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return;
    setSavingCat(true);
    const body = {
      name: catForm.name.trim(),
      color: catForm.color,
      sla_hours: Number(catForm.sla_hours) || 24,
      team: catForm.team,
      default_priority: catForm.default_priority || null,
    };
    const url = editingCatId ? `/api/chamados/categorias/${editingCatId}` : "/api/chamados/categorias";
    const method = editingCatId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSavingCat(false);
    if (res.ok) { setShowCatForm(false); fetchCategories(); }
  };

  const toggleCatActive = async (cat: Category) => {
    await fetch(`/api/chamados/categorias/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !cat.active }),
    });
    fetchCategories();
  };

  const fc = (field: keyof typeof EMPTY_CAT) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setCatForm(prev => ({ ...prev, [field]: e.target.value }));

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
  };

  const closeResolveModal = () => {
    setResolveModal(null);
    setResolveSolution("");
    setResolveAssignTo("");
    setResolveMaterials("");
    setResolveCost("");
  };

  const doResolve = async () => {
    if (!resolveModal || !resolveSolution.trim()) return;
    const assignee = resolveAssignTo || resolveModal.assigned?.id;
    if (!assignee) return;
    const isManutencao = resolveModal.team === "manutencao";
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
      alert(json?.error ?? "Erro ao resolver chamado");
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
          {tab !== "categorias" && (
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
        )}
          <Link href="/admin/chamados/indicadores">
            <Button variant="outline" size="sm"><BarChart2 size={16} /> Indicadores ONA</Button>
          </Link>
        </div>
      </div>

      {/* Filtro de equipe — oculto em categorias */}
      {tab !== "categorias" && (
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
      )}

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

      {/* Busca + filtros avançados — ocultos na aba de categorias */}
      {tab !== "categorias" && <div className="space-y-3">
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
      </div>}

      {/* ── Painel de Categorias ─────────────────────────────────────────── */}
      {tab === "categorias" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Gerencie as categorias de chamados, SLA e prioridade padrão.
            </p>
            <Button onClick={openCreateCat} className="gap-2">
              <Plus size={14} /> Nova Categoria
            </Button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Categoria</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Equipe</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">SLA</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Prioridade Padrão</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingCats ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhuma categoria cadastrada</td></tr>
                ) : categories.map(cat => (
                  <tr key={cat.id} className={`transition-colors ${cat.active ? "hover:bg-gray-50" : "opacity-50 bg-gray-50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cat.team === "ti"
                        ? <Badge className="text-xs bg-blue-100 text-blue-700 border-0">TI</Badge>
                        : cat.team === "marketing"
                          ? <Badge className="text-xs bg-pink-100 text-pink-700 border-0">MKT</Badge>
                          : <Badge className="text-xs bg-orange-100 text-orange-700 border-0">Manutenção</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm"><Clock size={12} />{cat.sla_hours}h</span>
                    </td>
                    <td className="px-4 py-3">
                      {cat.default_priority
                        ? <Badge className={`text-xs border-0 ${PRIORITY[cat.default_priority]?.color}`}>{PRIORITY[cat.default_priority]?.label}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border-0 ${cat.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {cat.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEditCat(cat)} title="Editar">
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className={cat.active ? "text-gray-400 hover:text-red-500" : "text-gray-400 hover:text-green-600"}
                          onClick={() => toggleCatActive(cat)}
                          title={cat.active ? "Desativar" : "Reativar"}
                        >
                          {cat.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela (modo lista) */}
      {tab !== "categorias" && viewMode === "list" && (
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
      {tab !== "categorias" && viewMode === "kanban" && (
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
              {["open","in_progress","waiting_user"].includes(selected.status) && (
                <div className="flex gap-2 items-center border rounded-lg px-3 py-2 bg-muted/50">
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
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
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
                {selected.status === "waiting_user" && (
                  <Button size="sm" onClick={() => doAction("set_status", { status: "in_progress" })} disabled={actioning}>
                    <RefreshCw size={14} /> Retomar Atendimento
                  </Button>
                )}
                {["in_progress","waiting_user"].includes(selected.status) && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => openResolveModal(selected)} disabled={actioning}>
                    <CheckCircle2 size={14} /> Resolver
                  </Button>
                )}
                {["open","in_progress","waiting_user"].includes(selected.status) && (
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
                <div className="space-y-3 py-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-16" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {selected.ticket_categories && (
                      <span className="text-xs px-2 py-1 rounded-full text-white font-medium"
                        style={{ backgroundColor: selected.ticket_categories.color }}>
                        {selected.ticket_categories.name}
                      </span>
                    )}
                    <Badge className={`text-xs border-0 ${PRIORITY[selected.priority]?.color}`}>
                      {PRIORITY[selected.priority]?.label}
                    </Badge>
                    <Badge className={`text-xs border-0 ${STATUS[selected.status]?.color}`}>
                      {STATUS[selected.status]?.label}
                    </Badge>
                    {selected.assigned && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <User size={11} />{selected.assigned.full_name}
                      </Badge>
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

                  {/* Histórico do equipamento (patrimônio) */}
                  {detail.ticket.equipment_patrimonio && patrHistory.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPatrHistory(v => !v)}
                        className="w-full flex items-center justify-between bg-gray-50 px-4 py-2.5 text-sm font-medium hover:bg-gray-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <History size={15} />
                          Histórico deste equipamento ({patrHistory.length} chamado{patrHistory.length > 1 ? "s" : ""})
                          <span className="font-mono text-xs text-muted-foreground">Pat. {detail.ticket.equipment_patrimonio}</span>
                        </span>
                        {showPatrHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {showPatrHistory && (
                        <div className="divide-y">
                          {patrHistory.map(t => (
                            <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                              <span className="font-mono text-xs text-muted-foreground shrink-0">#{String(t.number).padStart(4, "0")}</span>
                              <span className="flex-1 truncate">{t.title}</span>
                              <Badge className={`text-xs border-0 shrink-0 ${STATUS[t.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                                {STATUS[t.status]?.label ?? t.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground shrink-0">{formatDate(t.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Modal Categoria */}
      <Dialog open={showCatForm} onOpenChange={v => { if (!v) setShowCatForm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag size={16} /> {editingCatId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Suporte a Sistemas" value={catForm.name} onChange={fc("name")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Equipe</Label>
                <Select value={catForm.team} onValueChange={v => setCatForm(p => ({ ...p, team: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ti">TI</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="marketing">Marketing (MKT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" className="h-9 w-12 p-0.5 cursor-pointer" value={catForm.color} onChange={fc("color")} />
                  <span className="text-xs font-mono text-muted-foreground">{catForm.color}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SLA (horas)</Label>
                <Input type="number" min="1" step="1" placeholder="24" value={catForm.sla_hours} onChange={fc("sla_hours")} />
                <p className="text-[10px] text-muted-foreground">Prazo máximo de atendimento</p>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade Padrão</Label>
                <Select value={catForm.default_priority || "__none__"} onValueChange={v => setCatForm(p => ({ ...p, default_priority: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma (manual)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma (manual)</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Pré-preenche ao abrir chamado</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCatForm(false)}>Cancelar</Button>
              <Button onClick={saveCat} disabled={!catForm.name.trim() || savingCat}>
                {savingCat ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : editingCatId ? "Salvar" : "Criar Categoria"}
              </Button>
            </DialogFooter>
          </div>
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
