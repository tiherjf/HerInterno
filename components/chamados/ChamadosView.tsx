"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, TicketCheck, Clock, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, RotateCcw, Monitor, Wrench, Megaphone, Lock, Loader2,
  Pencil, Sparkles, CalendarClock, User, FileText, MapPin, Paperclip,
  ExternalLink, X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────
interface Category {
  id: string; name: string; color: string;
  sla_hours: number; alteracao_sla_hours: number | null; team: string;
}

interface Attachment {
  id: string; file_name: string; file_url: string; file_size: number;
}

interface Ticket {
  id: string; number: number; title: string; priority: string; status: string;
  requester_name: string; requester_sector: string | null;
  created_at: string; sla_deadline: string | null; resolved_at: string | null; rating: number | null;
  ticket_categories: { id: string; name: string; color: string } | null;
  team: string;
  mkt_protocolo: string | null;
  mkt_is_alteracao: boolean | null;
  mkt_prazo_desejado: string | null;
  location: string | null;
  urgency: string | null;
  equipment_description: string | null;
  equipment_patrimonio: string | null;
}

interface HistoryEntry {
  id: string; user_name: string; action: string;
  old_value: string | null; new_value: string | null; created_at: string;
}

type TimelineItem =
  | ({ kind: "comment" } & { id: string; author_name: string; content: string; is_internal: boolean; created_at: string })
  | ({ kind: "history" } & HistoryEntry);

interface MyProfile { full_name: string; sector: string; phone_ext: string; }

// ─── Constants ───────────────────────────────────────────────
const URGENCY_OPTIONS = [
  { key: "muito_alta", label: "Muito Alta", activeColor: "border-red-500 bg-red-50 text-red-700",        badgeColor: "bg-red-100 text-red-700" },
  { key: "alta",       label: "Alta",       activeColor: "border-orange-500 bg-orange-50 text-orange-700", badgeColor: "bg-orange-100 text-orange-700" },
  { key: "media",      label: "Média",      activeColor: "border-yellow-500 bg-yellow-50 text-yellow-700", badgeColor: "bg-yellow-100 text-yellow-700" },
  { key: "baixa",      label: "Baixa",      activeColor: "border-blue-500 bg-blue-50 text-blue-700",      badgeColor: "bg-blue-100 text-blue-700" },
];

const URGENCY_TO_PRIORITY: Record<string, string> = {
  muito_alta: "critical", alta: "high", media: "medium", baixa: "low",
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low:      { label: "Baixa",   color: "bg-blue-100 text-blue-700" },
  medium:   { label: "Média",   color: "bg-yellow-100 text-yellow-700" },
  high:     { label: "Alta",    color: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  open:        { label: "Aberto",         icon: <Clock size={12} />,        color: "bg-gray-100 text-gray-700" },
  in_progress: { label: "Em Atendimento", icon: <RefreshCw size={12} />,    color: "bg-blue-100 text-blue-700" },
  resolved:    { label: "Resolvido",      icon: <CheckCircle2 size={12} />, color: "bg-green-100 text-green-700" },
  closed:      { label: "Encerrado",      icon: <CheckCircle2 size={12} />, color: "bg-green-100 text-green-700" },
  cancelled:   { label: "Cancelado",      icon: <XCircle size={12} />,      color: "bg-red-100 text-red-700" },
};

const TEAM_OPTIONS = [
  { key: "ti",         label: "Suporte TI",      icon: Monitor,   desc: "Sistemas, redes, equipamentos",     color: "border-blue-500 bg-blue-50 text-blue-700" },
  { key: "manutencao", label: "Manutenção",       icon: Wrench,    desc: "Instalações, elétrica, hidráulica", color: "border-orange-500 bg-orange-50 text-orange-700" },
  { key: "marketing",  label: "Solicitações MKT", icon: Megaphone, desc: "Artes, comunicação, materiais",     color: "border-pink-500 bg-pink-50 text-pink-700" },
] as const;

type TeamKey = typeof TEAM_OPTIONS[number]["key"];

const TEAM_LABELS: Record<string, string> = { ti: "TI", manutencao: "Manutenção", marketing: "MKT" };

const FILTERS = [
  { key: "",                label: "Todos" },
  { key: "open",            label: "Abertos" },
  { key: "in_progress",     label: "Em Atendimento" },
  { key: "resolved,closed", label: "Resolvidos" },
  { key: "cancelled",       label: "Cancelados" },
];

// ─── Sub-components ──────────────────────────────────────────
function SlaIndicator({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline || ["resolved", "closed", "cancelled"].includes(status)) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return (
    <span className="text-xs text-red-600 font-medium flex items-center gap-1">
      <AlertTriangle size={11} /> SLA vencido
    </span>
  );
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const color = diff < 3600000 ? "text-red-500" : diff < 7200000 ? "text-yellow-500" : "text-green-600";
  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${color}`}>
      <Clock size={11} /> {hours > 0 ? `${hours}h ${mins}m` : `${mins}min`}
    </span>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`text-2xl leading-none transition-colors ${n <= value ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`}
        >★</button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function ChamadosView({ defaultTeam }: { defaultTeam?: string }) {
  const isMkt = defaultTeam === "marketing";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [detail, setDetail] = useState<{
    ticket: Ticket & {
      description: string;
      rating_comment: string | null;
      ticket_comments: Array<{ id: string; author_name: string; content: string; is_internal: boolean; created_at: string }>;
      ticket_history: HistoryEntry[];
      ticket_attachments: Attachment[];
    }
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    title: "", description: "", category_id: "", priority: "medium",
    team: (defaultTeam ?? "ti") as TeamKey,
  });
  const [mktIsAlteracao, setMktIsAlteracao] = useState(false);
  const [mktPrazo, setMktPrazo] = useState("");
  const [lastProtocolo, setLastProtocolo] = useState<string | null>(null);

  // Manutenção-specific form state
  const [mntLocation, setMntLocation] = useState("");
  const [mntUrgency, setMntUrgency] = useState("media");
  const [mntEquipDesc, setMntEquipDesc] = useState("");
  const [mntEquipPatr, setMntEquipPatr] = useState("");
  const [attachFiles, setAttachFiles] = useState<File[]>([]);

  const isManutencao = form.team === "manutencao";

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const teamParam = defaultTeam ? `&team=${defaultTeam}` : "";
      const res = await fetch(`/api/chamados?view=own&limit=100${teamParam}`);
      const json = await res.json();
      setTickets(json.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }, [defaultTeam]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    fetch("/api/chamados/categorias").then(r => r.json()).then(j => setCategories(j.categories ?? []));
  }, []);

  useEffect(() => {
    if (isMkt) {
      fetch("/api/perfil").then(r => r.json()).then(data => {
        if (data.full_name) setMyProfile(data as MyProfile);
      }).catch(() => {});
    }
  }, [isMkt]);

  const categoriasByTeam = useMemo(() => {
    const map: Record<string, Category[]> = { ti: [], manutencao: [], marketing: [] };
    for (const c of categories) {
      if (map[c.team]) map[c.team].push(c);
      else map[c.team] = [c];
    }
    return map;
  }, [categories]);

  const openDetail = async (ticket: Ticket) => {
    setSelected(ticket);
    setLoadingDetail(true);
    setDetail(null);
    setComment("");
    setRating(0);
    setRatingComment("");
    const res = await fetch(`/api/chamados/${ticket.id}`);
    setDetail(await res.json());
    setLoadingDetail(false);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", category_id: "", priority: "medium", team: (defaultTeam ?? "ti") as TeamKey });
    setMktIsAlteracao(false);
    setMktPrazo("");
    setLastProtocolo(null);
    setMntLocation("");
    setMntUrgency("media");
    setMntEquipDesc("");
    setMntEquipPatr("");
    setAttachFiles([]);
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    if (isManutencao && !mntLocation.trim()) {
      alert("Informe a localização do problema.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category_id: form.category_id || undefined,
          priority: isManutencao ? (URGENCY_TO_PRIORITY[mntUrgency] ?? "medium") : form.priority,
          team: form.team,
          location: isManutencao ? mntLocation.trim() : undefined,
          urgency: isManutencao ? mntUrgency : undefined,
          equipment_description: isManutencao && mntEquipDesc.trim() ? mntEquipDesc.trim() : undefined,
          equipment_patrimonio: isManutencao && mntEquipPatr.trim() ? mntEquipPatr.trim() : undefined,
          mkt_is_alteracao: isMkt ? mktIsAlteracao : undefined,
          mkt_prazo_desejado: isMkt && mktPrazo ? mktPrazo : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }

      // Upload attachments sequentially after ticket creation
      if (attachFiles.length > 0 && json.id) {
        for (const file of attachFiles) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/chamados/${json.id}/anexos`, { method: "POST", body: fd });
        }
      }

      if (json.mkt_protocolo) setLastProtocolo(json.mkt_protocolo);
      resetForm();
      fetchTickets();
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!comment.trim() || !selected) return;
    setSubmittingComment(true);
    await fetch(`/api/chamados/${selected.id}/comentarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    setComment("");
    const res = await fetch(`/api/chamados/${selected.id}`);
    setDetail(await res.json());
    setSubmittingComment(false);
  };

  const submitRating = async () => {
    if (!rating || !selected) return;
    setSubmittingRating(true);
    await fetch(`/api/chamados/${selected.id}/avaliar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, rating_comment: ratingComment }),
    });
    setSubmittingRating(false);
    fetchTickets();
    const res = await fetch(`/api/chamados/${selected.id}`);
    const json = await res.json();
    setDetail(json);
    if (json.ticket) setSelected(json.ticket);
  };

  const cancelTicket = async () => {
    if (!selected) return;
    await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setCancelDialogOpen(false);
    setSelected(null);
    setDetail(null);
    fetchTickets();
  };

  const reopenTicket = async () => {
    if (!selected) return;
    await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    setReopenDialogOpen(false);
    fetchTickets();
    const res = await fetch(`/api/chamados/${selected.id}`);
    const json = await res.json();
    setDetail(json);
    if (json.ticket) setSelected(json.ticket);
  };

  const filtered = tickets.filter(t => !filter || filter.split(",").includes(t.status));
  const catsForTeam = categoriasByTeam[form.team] ?? [];
  const selectedTeamInfo = TEAM_OPTIONS.find(t => t.key === form.team) ?? TEAM_OPTIONS[0];
  const teamTitle = defaultTeam ? TEAM_OPTIONS.find(t => t.key === defaultTeam)?.label : undefined;
  const selectedMktCat = isMkt ? catsForTeam.find(c => c.id === form.category_id) ?? null : null;
  const slaPreview = selectedMktCat
    ? (mktIsAlteracao && selectedMktCat.alteracao_sla_hours ? selectedMktCat.alteracao_sla_hours : selectedMktCat.sla_hours)
    : null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {teamTitle ? `${isMkt ? "Solicitações " : "Meus Chamados — "}${teamTitle}` : "Meus Chamados"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMkt ? "Solicite materiais e comunicações ao setor de Marketing" : "Acompanhe e abra solicitações de suporte"}
          </p>
        </div>
        <Button onClick={() => { setLastProtocolo(null); setOpenNew(true); }}
          className={isMkt ? "bg-pink-600 hover:bg-pink-700" : ""}>
          <Plus size={16} /> {isMkt ? "Nova Solicitação" : "Abrir Chamado"}
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)} className="rounded-full">
            {f.label}
            {f.key === "" && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">{tickets.length}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TicketCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>{isMkt ? "Nenhuma solicitação encontrada" : "Nenhum chamado encontrado"}</p>
          <Button className="mt-4" onClick={() => setOpenNew(true)}>
            {isMkt ? "Abrir primeira solicitação" : "Abrir primeiro chamado"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(ticket => {
            const prio = PRIORITY_LABELS[ticket.priority];
            const stat = STATUS_LABELS[ticket.status];
            const urgOpt = ticket.urgency ? URGENCY_OPTIONS.find(u => u.key === ticket.urgency) : null;
            return (
              <button key={ticket.id} onClick={() => openDetail(ticket)}
                className="w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {ticket.mkt_protocolo ? (
                        <span className="text-xs font-mono font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                          {ticket.mkt_protocolo}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">
                          #{String(ticket.number).padStart(4, "0")}
                        </span>
                      )}
                      {ticket.mkt_is_alteracao && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                          <Pencil size={9} /> Alteração
                        </span>
                      )}
                      {!defaultTeam && TEAM_LABELS[ticket.team] && (
                        <Badge variant="secondary" className="text-xs">{TEAM_LABELS[ticket.team]}</Badge>
                      )}
                      {ticket.ticket_categories && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: ticket.ticket_categories.color }}>
                          {ticket.ticket_categories.name}
                        </span>
                      )}
                      {urgOpt ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgOpt.badgeColor}`}>
                          {urgOpt.label}
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prio?.color ?? ""}`}>{prio?.label}</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                    {ticket.team === "manutencao" && ticket.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {ticket.location}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</p>
                      {ticket.mkt_prazo_desejado && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarClock size={11} />
                          Prazo: {new Date(ticket.mkt_prazo_desejado + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${stat.color}`}>
                      {stat.icon} {stat.label}
                    </span>
                    <SlaIndicator deadline={ticket.sla_deadline} status={ticket.status} />
                    {ticket.rating && (
                      <span className="text-xs text-yellow-500">
                        {"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ──── Modal: novo chamado ──── */}
      <Dialog open={openNew} onOpenChange={v => { if (!v) resetForm(); setOpenNew(v); }}>
        <DialogContent className={`${isMkt ? "max-w-xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isMkt ? <><Megaphone size={18} className="text-pink-600" /> Nova Solicitação de Comunicação</> : "Abrir Chamado"}
            </DialogTitle>
          </DialogHeader>

          {lastProtocolo && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
              <p className="text-sm text-green-700 font-medium">Solicitação registrada com sucesso!</p>
              <p className="text-2xl font-bold text-green-800 font-mono mt-1">{lastProtocolo}</p>
              <p className="text-xs text-green-600 mt-1">Guarde este protocolo para acompanhar o andamento</p>
              <Button className="mt-3" size="sm" onClick={() => setLastProtocolo(null)}>
                <Plus size={14} /> Nova solicitação
              </Button>
            </div>
          )}

          {!lastProtocolo && (
            <form onSubmit={submitNew} className="space-y-4">
              {/* Team selector ou badge fixo */}
              {!defaultTeam ? (
                <div className="space-y-2">
                  <Label>Para onde vai essa solicitação? *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEAM_OPTIONS.map(t => {
                      const Icon = t.icon;
                      const isActive = form.team === t.key;
                      return (
                        <button key={t.key} type="button"
                          onClick={() => setForm(p => ({ ...p, team: t.key, category_id: "" }))}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                            isActive ? t.color + " shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                          }`}>
                          <Icon size={20} />
                          <span className="text-xs font-semibold leading-tight">{t.label}</span>
                          <span className="text-xs opacity-70 leading-tight hidden sm:block">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${selectedTeamInfo.color}`}>
                  {(() => { const Icon = selectedTeamInfo.icon; return <Icon size={16} />; })()}
                  <div>
                    <p className="text-sm font-semibold">{selectedTeamInfo.label}</p>
                    <p className="text-xs opacity-75">{selectedTeamInfo.desc}</p>
                  </div>
                  <Lock size={13} className="ml-auto opacity-50" />
                </div>
              )}

              {/* ──── MKT exclusivo ──── */}
              {(form.team === "marketing" || isMkt) && (
                <>
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-pink-700 mb-1.5 flex items-center gap-1">
                      <User size={12} /> Solicitante
                    </p>
                    {myProfile ? (
                      <p className="text-sm font-medium text-gray-800">
                        {myProfile.full_name}
                        {myProfile.sector && <span className="text-muted-foreground font-normal"> — {myProfile.sector}</span>}
                      </p>
                    ) : (
                      <Skeleton className="h-4 w-48" />
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Preenchido com seus dados de perfil</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de material *</Label>
                    <Select value={form.category_id || "__none__"}
                      onValueChange={v => setForm(p => ({ ...p, category_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo de demanda..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione...</SelectItem>
                        {(categoriasByTeam["marketing"] ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de solicitação *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMktIsAlteracao(false)}
                        className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                          !mktIsAlteracao ? "border-pink-500 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        <Sparkles size={18} className="shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">Nova criação</p>
                          {selectedMktCat && !mktIsAlteracao && <p className="text-xs opacity-70">SLA: {selectedMktCat.sla_hours}h</p>}
                        </div>
                      </button>
                      <button type="button" onClick={() => setMktIsAlteracao(true)}
                        className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                          mktIsAlteracao ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        <Pencil size={18} className="shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">Alteração</p>
                          {selectedMktCat && mktIsAlteracao && (
                            <p className="text-xs opacity-70">
                              {selectedMktCat.alteracao_sla_hours ? `SLA: ${selectedMktCat.alteracao_sla_hours}h` : "SLA igual"}
                            </p>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {slaPreview !== null && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                      <Clock size={14} className="text-blue-600 shrink-0" />
                      <span className="text-blue-700">
                        Prazo conforme <strong>POL HER 003</strong>: <strong>{slaPreview}h</strong> a partir da abertura
                        {mktIsAlteracao && !selectedMktCat?.alteracao_sla_hours && " (sem prazo reduzido para alteração neste tipo)"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="mkt-prazo">Data limite desejada</Label>
                    <Input id="mkt-prazo" type="date" value={mktPrazo}
                      onChange={e => setMktPrazo(e.target.value)}
                      min={new Date().toISOString().split("T")[0]} />
                    <p className="text-xs text-muted-foreground">Informativo — o prazo real segue a POL HER 003</p>
                  </div>
                </>
              )}

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="ticket-title">
                  {isMkt ? "Título / Assunto da solicitação *" : "Título *"}
                </Label>
                <Input id="ticket-title" required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={
                    isMkt ? "Ex.: Banner Dia dos Médicos, Comunicado Férias..."
                    : isManutencao ? "Resumo do problema: Ex.: AC sem funcionar, Torneira quebrada..."
                    : "Descreva brevemente o problema ou pedido"
                  }
                />
              </div>

              {/* Categoria (+ prioridade para TI) */}
              {form.team !== "marketing" && !isMkt && (
                <div className={`grid gap-3 ${isManutencao ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.category_id || "__none__"}
                      onValueChange={v => setForm(p => ({ ...p, category_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione...</SelectItem>
                        {catsForTeam.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isManutencao && (
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* ──── Manutenção exclusivo ──── */}
              {isManutencao && (
                <>
                  {/* Localização */}
                  <div className="space-y-2">
                    <Label htmlFor="mnt-location">Localização do problema *</Label>
                    <Input
                      id="mnt-location"
                      required
                      value={mntLocation}
                      onChange={e => setMntLocation(e.target.value)}
                      placeholder="Ex: Térreo — Recepção, 2º Andar — UTI, Sala 302, Banheiro masculino..."
                    />
                  </div>

                  {/* Urgência */}
                  <div className="space-y-2">
                    <Label>Urgência *</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {URGENCY_OPTIONS.map(u => (
                        <button
                          key={u.key}
                          type="button"
                          onClick={() => setMntUrgency(u.key)}
                          className={`py-2.5 px-3 rounded-lg border-2 text-center transition-all text-sm font-medium ${
                            mntUrgency === u.key ? u.activeColor : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Equipamento */}
                  <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Wrench size={13} />
                      Equipamento envolvido
                      <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mnt-patr" className="text-xs text-gray-600">Nº de Patrimônio</Label>
                        <Input
                          id="mnt-patr"
                          value={mntEquipPatr}
                          onChange={e => setMntEquipPatr(e.target.value)}
                          placeholder="Ex: 00123"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mnt-equip" className="text-xs text-gray-600">Descrição</Label>
                        <Input
                          id="mnt-equip"
                          value={mntEquipDesc}
                          onChange={e => setMntEquipDesc(e.target.value)}
                          placeholder="Ex: Ar-condicionado, Torneira..."
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="ticket-desc">
                  {isMkt ? "Descrição da demanda *" : "Descrição detalhada *"}
                </Label>
                <Textarea id="ticket-desc" required rows={isMkt ? 5 : 4}
                  placeholder={
                    isMkt
                      ? "Descreva o objetivo do material, público-alvo, tom de comunicação, informações que devem constar e qualquer detalhe relevante."
                    : isManutencao
                      ? "Descreva o problema com detalhes: há quanto tempo ocorre, afeta o atendimento, alguma observação importante?"
                    : "O que aconteceu? Quando? Qual equipamento ou sistema está envolvido?"
                  }
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="resize-none"
                />
              </div>

              {/* Anexos */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Paperclip size={13} />
                  {isManutencao ? "Fotos do problema" : "Anexos"}
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      setAttachFiles(prev => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                  <Paperclip size={18} className="mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar arquivos</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Imagens, PDF, Word, Excel — máx. 10 MB por arquivo</p>
                </div>
                {attachFiles.length > 0 && (
                  <ul className="space-y-1">
                    {attachFiles.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded-lg border">
                        <FileText size={13} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          onClick={() => setAttachFiles(p => p.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-red-600 shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* SLA preview não-MKT */}
              {!isMkt && form.category_id && (() => {
                const cat = catsForTeam.find(c => c.id === form.category_id);
                return cat ? (
                  <p className="text-xs text-muted-foreground">SLA desta categoria: <strong>{cat.sla_hours}h</strong></p>
                ) : null;
              })()}

              <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
                {isMkt ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText size={11} /> Protocolo COM- gerado automaticamente
                  </p>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${selectedTeamInfo.color}`}>
                    Enviando para: {selectedTeamInfo.label}
                  </span>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Cancelar</Button>
                  <Button type="submit" disabled={submitting} className={isMkt ? "bg-pink-600 hover:bg-pink-700" : ""}>
                    {submitting
                      ? <><Loader2 size={14} className="animate-spin" /> {attachFiles.length > 0 ? "Enviando arquivos..." : "Enviando..."}</>
                      : isMkt ? "Enviar Solicitação" : "Abrir Chamado"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ──── Modal: detalhe ──── */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {selected.mkt_protocolo ? (
                    <span className="font-mono text-sm font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                      {selected.mkt_protocolo}
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-muted-foreground">
                      #{String(selected.number).padStart(4, "0")}
                    </span>
                  )}
                  {selected.mkt_is_alteracao && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                      <Pencil size={10} /> Alteração
                    </span>
                  )}
                  <span className="text-base font-semibold">{selected.title}</span>
                </DialogTitle>
              </DialogHeader>

              {loadingDetail ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-16" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  {/* Badges de status */}
                  <div className="flex flex-wrap gap-2">
                    {TEAM_LABELS[selected.team] && <Badge variant="secondary">{TEAM_LABELS[selected.team]}</Badge>}
                    {selected.ticket_categories && (
                      <span className="text-xs px-2 py-1 rounded-full text-white font-medium"
                        style={{ backgroundColor: selected.ticket_categories.color }}>
                        {selected.ticket_categories.name}
                      </span>
                    )}
                    {selected.urgency ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${URGENCY_OPTIONS.find(u => u.key === selected.urgency)?.badgeColor ?? ""}`}>
                        Urgência: {URGENCY_OPTIONS.find(u => u.key === selected.urgency)?.label}
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_LABELS[selected.priority]?.color ?? ""}`}>
                        {PRIORITY_LABELS[selected.priority]?.label}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${STATUS_LABELS[selected.status].color}`}>
                      {STATUS_LABELS[selected.status].icon} {STATUS_LABELS[selected.status].label}
                    </span>
                    <SlaIndicator deadline={selected.sla_deadline} status={selected.status} />
                  </div>

                  {/* Prazo MKT */}
                  {selected.mkt_prazo_desejado && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                      <CalendarClock size={14} className="shrink-0" />
                      Prazo desejado:{" "}
                      <strong className="text-foreground">
                        {new Date(selected.mkt_prazo_desejado + "T12:00:00").toLocaleDateString("pt-BR")}
                      </strong>
                    </div>
                  )}

                  {/* ──── Painel de manutenção ──── */}
                  {selected.team === "manutencao" && (
                    detail.ticket.location || detail.ticket.urgency ||
                    detail.ticket.equipment_description || detail.ticket.equipment_patrimonio
                  ) && (
                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detail.ticket.location && (
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-orange-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-orange-700 mb-0.5">Localização</p>
                            <p className="text-sm text-gray-800">{detail.ticket.location}</p>
                          </div>
                        </div>
                      )}
                      {detail.ticket.urgency && (
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-orange-700 mb-0.5">Urgência reportada</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_OPTIONS.find(u => u.key === detail.ticket.urgency)?.badgeColor ?? ""}`}>
                              {URGENCY_OPTIONS.find(u => u.key === detail.ticket.urgency)?.label}
                            </span>
                          </div>
                        </div>
                      )}
                      {(detail.ticket.equipment_description || detail.ticket.equipment_patrimonio) && (
                        <div className="flex items-start gap-2 sm:col-span-2">
                          <Wrench size={14} className="text-orange-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-orange-700 mb-0.5">Equipamento</p>
                            <p className="text-sm text-gray-800">
                              {detail.ticket.equipment_patrimonio && (
                                <span className="font-mono text-xs bg-white border border-orange-200 px-1.5 py-0.5 rounded mr-2">
                                  Pat. {detail.ticket.equipment_patrimonio}
                                </span>
                              )}
                              {detail.ticket.equipment_description}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Descrição */}
                  <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {detail.ticket.description}
                  </div>

                  {/* Anexos */}
                  {detail.ticket.ticket_attachments?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <Paperclip size={13} /> Anexos ({detail.ticket.ticket_attachments.length})
                      </p>
                      <div className="space-y-1">
                        {detail.ticket.ticket_attachments.map(att => (
                          <a
                            key={att.id}
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm transition-colors"
                          >
                            <FileText size={13} className="text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{att.file_name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {(att.file_size / 1024).toFixed(0)} KB
                            </span>
                            <ExternalLink size={11} className="text-muted-foreground shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {(() => {
                    const timeline: TimelineItem[] = [
                      ...(detail.ticket.ticket_comments ?? []).map(c => ({ kind: "comment" as const, ...c })),
                      ...(detail.ticket.ticket_history ?? []).map(h => ({ kind: "history" as const, ...h })),
                    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    if (!timeline.length) return null;
                    return (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-700">Atualizações</p>
                        {timeline.map(item =>
                          item.kind === "comment" ? (
                            <div key={item.id} className="rounded-lg p-3 text-sm bg-blue-50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{item.author_name}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-gray-700">{item.content}</p>
                            </div>
                          ) : (
                            <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                              <span>
                                {item.action === "status_changed"
                                  ? `Status: ${item.old_value} → ${item.new_value}`
                                  : item.action === "reopened" ? "Chamado reaberto" : item.action}
                              </span>
                              <span className="ml-auto">{formatDate(item.created_at)}</span>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}

                  {/* Comentário */}
                  {!["closed", "cancelled"].includes(selected.status) && (
                    <div className="space-y-2">
                      <Label htmlFor="ticket-comment">
                        {isMkt ? "Adicionar informação / referência" : "Adicionar resposta"}
                      </Label>
                      <Textarea id="ticket-comment" rows={3} className="resize-none"
                        placeholder={isMkt ? "Texto complementar, links de referência, observações..." : "Informação adicional..."}
                        value={comment} onChange={e => setComment(e.target.value)} />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={submitComment} disabled={submittingComment || !comment.trim()}>
                          {submittingComment ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Avaliação */}
                  {["resolved", "closed"].includes(selected.status) && !selected.rating && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">
                        {isMkt ? "Como foi o atendimento do Marketing?" : "Como foi o atendimento?"}
                      </p>
                      <StarRating value={rating} onChange={setRating} />
                      {rating > 0 && (
                        <>
                          <Textarea className="mt-2 resize-none" rows={2} placeholder="Comentário (opcional)"
                            value={ratingComment} onChange={e => setRatingComment(e.target.value)} />
                          <Button size="sm" className="mt-2" onClick={submitRating} disabled={submittingRating}>
                            {submittingRating ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : "Avaliar"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {selected.rating && (
                    <div className="bg-green-50 rounded-lg p-3 text-sm">
                      <p className="font-medium">Avaliado: {"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}</p>
                      {detail.ticket.rating_comment && (
                        <p className="text-muted-foreground mt-1">{detail.ticket.rating_comment}</p>
                      )}
                    </div>
                  )}

                  <Separator />
                  <div className="flex justify-end gap-2">
                    {selected.status === "open" && (
                      <Button variant="outline" size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => setCancelDialogOpen(true)}>
                        <XCircle size={14} /> {isMkt ? "Cancelar solicitação" : "Cancelar chamado"}
                      </Button>
                    )}
                    {selected.status === "resolved" && (
                      <Button variant="outline" size="sm" onClick={() => setReopenDialogOpen(true)}>
                        <RotateCcw size={14} /> Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar cancelar */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isMkt ? "Cancelar solicitação?" : "Cancelar chamado?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita facilmente.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={cancelTicket}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar reabrir */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reabrir?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isMkt ? "A solicitação voltará ao status Aberto." : "O chamado voltará ao status \"Aberto\"."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>Cancelar</Button>
            <Button onClick={reopenTicket}>Confirmar reabertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
