"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, TicketCheck, Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw, RotateCcw, Monitor, Wrench, Megaphone, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Category { id: string; name: string; color: string; sla_hours: number; team: string }

interface Ticket {
  id: string; number: number; title: string; priority: string; status: string;
  requester_name: string; requester_sector: string | null;
  created_at: string; sla_deadline: string | null; resolved_at: string | null; rating: number | null;
  ticket_categories: { id: string; name: string; color: string } | null;
  team: string;
}
interface HistoryEntry { id: string; user_name: string; action: string; old_value: string | null; new_value: string | null; created_at: string }
type TimelineItem =
  | ({ kind: "comment" } & { id: string; author_name: string; content: string; is_internal: boolean; created_at: string })
  | ({ kind: "history" } & HistoryEntry);

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

const TEAM_LABELS: Record<string, string> = {
  ti: "TI",
  manutencao: "Manutenção",
  marketing: "MKT",
};

function SlaIndicator({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline || ["resolved", "closed", "cancelled"].includes(status)) return null;
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;
  if (diff <= 0) return <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle size={11} /> SLA vencido</span>;
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
        <button key={n} onClick={() => onChange(n)}
          className={`text-2xl leading-none transition-colors ${n <= value ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`}
        >★</button>
      ))}
    </div>
  );
}

const FILTERS = [
  { key: "",                label: "Todos" },
  { key: "open",            label: "Abertos" },
  { key: "in_progress",     label: "Em Atendimento" },
  { key: "resolved,closed", label: "Resolvidos" },
  { key: "cancelled",       label: "Cancelados" },
];

export function ChamadosView({ defaultTeam }: { defaultTeam?: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    }
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category_id: "", priority: "medium",
    team: (defaultTeam ?? "ti") as TeamKey,
  });
  const [submitting, setSubmitting] = useState(false);

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

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category_id: form.category_id || undefined,
          priority: form.priority,
          team: form.team,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }
      setOpenNew(false);
      setForm({ title: "", description: "", category_id: "", priority: "medium", team: (defaultTeam ?? "ti") as TeamKey });
      fetchTickets();
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!comment.trim() || !selected) return;
    setSubmittingComment(true);
    await fetch(`/api/chamados/${selected.id}/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    if (!selected || !confirm("Cancelar este chamado?")) return;
    await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setSelected(null);
    setDetail(null);
    fetchTickets();
  };

  const reopenTicket = async () => {
    if (!selected || !confirm("Reabrir este chamado?")) return;
    await fetch(`/api/chamados/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {teamTitle ? `Meus Chamados — ${teamTitle}` : "Meus Chamados"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe e abra solicitações de suporte</p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus size={16} /> Abrir Chamado
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key ? "bg-blue-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}
          >
            {f.label}
            {f.key === "" && (
              <span className="ml-1.5 bg-blue-100 text-blue-700 rounded-full px-1.5 text-xs">{tickets.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-xl border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TicketCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum chamado encontrado</p>
          <Button className="mt-4" onClick={() => setOpenNew(true)}>Abrir primeiro chamado</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(ticket => {
            const prio = PRIORITY_LABELS[ticket.priority];
            const stat = STATUS_LABELS[ticket.status];
            return (
              <button key={ticket.id} onClick={() => openDetail(ticket)}
                className="w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{String(ticket.number).padStart(4, "0")}
                      </span>
                      {!defaultTeam && TEAM_LABELS[ticket.team] && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {TEAM_LABELS[ticket.team]}
                        </span>
                      )}
                      {ticket.ticket_categories && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: ticket.ticket_categories.color }}>
                          {ticket.ticket_categories.name}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prio.color}`}>{prio.label}</span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(ticket.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${stat.color}`}>
                      {stat.icon} {stat.label}
                    </span>
                    <SlaIndicator deadline={ticket.sla_deadline} status={ticket.status} />
                    {ticket.rating && (
                      <span className="text-xs text-yellow-500">{"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal: novo chamado */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Abrir Chamado</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitNew} className="space-y-4">
            {!defaultTeam ? (
              <div>
                <label className="text-sm font-medium">Para onde vai essa solicitação? *</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {TEAM_OPTIONS.map(t => {
                    const Icon = t.icon;
                    const isActive = form.team === t.key;
                    return (
                      <button key={t.key} type="button"
                        onClick={() => setForm(p => ({ ...p, team: t.key, category_id: "" }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          isActive ? t.color + " shadow-sm" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                        }`}
                      >
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

            <div>
              <label className="text-sm font-medium">Título *</label>
              <input className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="Descreva brevemente o problema ou pedido"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {catsForTeam.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {catsForTeam.length === 0 && <option disabled>Nenhuma categoria cadastrada</option>}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                  value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Descrição detalhada *</label>
              <textarea className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none" rows={4}
                placeholder={
                  form.team === "ti" ? "O que aconteceu? Quando? Qual equipamento ou sistema está envolvido?"
                  : form.team === "manutencao" ? "O que precisa ser feito? Onde está o problema? Qual a urgência?"
                  : "O que você precisa? Tamanho, formato, prazo, referências..."
                }
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            </div>

            {form.category_id && (() => {
              const cat = catsForTeam.find(c => c.id === form.category_id);
              return cat ? (
                <p className="text-xs text-muted-foreground">SLA desta categoria: <strong>{cat.sla_hours}h</strong> a partir da abertura</p>
              ) : null;
            })()}

            <div className="flex items-center justify-between gap-2 pt-2">
              <span className={`text-xs px-2 py-1 rounded-full border font-medium ${selectedTeamInfo.color}`}>
                Enviando para: {selectedTeamInfo.label}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Abrir Chamado"}</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: detalhe */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">
                    #{String(selected.number).padStart(4, "0")}
                  </span>
                  {selected.title}
                </DialogTitle>
              </DialogHeader>

              {loadingDetail ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {TEAM_LABELS[selected.team] && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {TEAM_LABELS[selected.team]}
                      </span>
                    )}
                    {selected.ticket_categories && (
                      <span className="text-xs px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: selected.ticket_categories.color }}>
                        {selected.ticket_categories.name}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_LABELS[selected.priority].color}`}>
                      {PRIORITY_LABELS[selected.priority].label}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${STATUS_LABELS[selected.status].color}`}>
                      {STATUS_LABELS[selected.status].icon} {STATUS_LABELS[selected.status].label}
                    </span>
                    <SlaIndicator deadline={selected.sla_deadline} status={selected.status} />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">{detail.ticket.description}</div>

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
                                {item.action === "status_changed" ? `Status atualizado: ${item.old_value} → ${item.new_value}`
                                  : item.action === "reopened" ? "Chamado reaberto" : item.action}
                              </span>
                              <span className="ml-auto">{formatDate(item.created_at)}</span>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}

                  {!["closed", "cancelled"].includes(selected.status) && (
                    <div>
                      <label className="text-sm font-medium">Adicionar resposta</label>
                      <textarea className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none" rows={3}
                        placeholder="Informação adicional, atualização do problema..."
                        value={comment} onChange={e => setComment(e.target.value)} />
                      <div className="flex justify-end mt-2">
                        <Button size="sm" onClick={submitComment} disabled={submittingComment || !comment.trim()}>
                          {submittingComment ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {["resolved", "closed"].includes(selected.status) && !selected.rating && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Como foi o atendimento?</p>
                      <StarRating value={rating} onChange={setRating} />
                      {rating > 0 && (
                        <>
                          <textarea className="w-full mt-2 border rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                            placeholder="Comentário (opcional)" value={ratingComment}
                            onChange={e => setRatingComment(e.target.value)} />
                          <Button size="sm" className="mt-2" onClick={submitRating} disabled={submittingRating}>
                            {submittingRating ? "Enviando..." : "Avaliar Atendimento"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {selected.rating && (
                    <div className="bg-green-50 rounded-lg p-3 text-sm">
                      <p className="font-medium">
                        Avaliado: {"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}
                      </p>
                      {detail.ticket.rating_comment && (
                        <p className="text-muted-foreground mt-1">{detail.ticket.rating_comment}</p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    {selected.status === "open" && (
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={cancelTicket}>
                        <XCircle size={14} /> Cancelar chamado
                      </Button>
                    )}
                    {selected.status === "resolved" && (
                      <Button variant="outline" size="sm" onClick={reopenTicket}>
                        <RotateCcw size={14} /> Reabrir chamado
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
