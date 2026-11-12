"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EventCalendar from "@/components/eventos/EventCalendar";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { useMenuPermission } from "@/components/menu/MenuPermissionsContext";
import { EventAgendaRow, type ListEvent } from "@/components/eventos/EventAgendaRow";
import { EventHighlight } from "@/components/eventos/EventHighlight";
import { eventStatus } from "@/lib/eventos/status";
import { groupByMonth } from "@/lib/eventos/dates";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "palestra", label: "Palestra" },
  { value: "treinamento", label: "Treinamento" },
  { value: "confraternizacao", label: "Confraternização" },
  { value: "comemoracao", label: "Comemoração" },
  { value: "curso", label: "Curso" },
  { value: "outro", label: "Outro" },
];

type Tab = "upcoming" | "calendar" | "mine" | "past";
type Event = ListEvent;

const EMPTY: Record<Exclude<Tab, "calendar">, string> = {
  upcoming: "Nenhum evento programado.",
  mine: "Você ainda não se inscreveu em nenhum evento.",
  past: "Nenhum evento anterior.",
};

export default function EventosPage() {
  const { canEdit: canManageEventos } = useMenuPermission("eventos");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [category, setCategory] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("view", tab === "calendar" ? "all" : tab);
      if (category) params.set("category", category);
      if (tab === "calendar") params.set("month", calendarMonth);

      const res = await fetch(`/api/eventos?${params}`);
      const json = await res.json();
      setEvents(json.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [tab, category, calendarMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function handleRegister(ev: Event) {
    setActing(ev.id);
    const method = ev.is_registered || ev.on_waitlist ? "DELETE" : "POST";
    const res = await fetch(`/api/eventos/${ev.id}/inscrever`, { method });
    const json = await res.json();
    if (res.ok) {
      setEvents(prev => prev.map(e => {
        if (e.id !== ev.id) return e;
        if (method === "DELETE") {
          return { ...e, is_registered: false, on_waitlist: false, slots_used: Math.max(0, e.slots_used - 1) };
        }
        if (json.status === "waitlist") return { ...e, on_waitlist: true };
        return { ...e, is_registered: true, slots_used: e.slots_used + 1 };
      }));
    }
    setActing(null);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "upcoming", label: "Próximos" },
    { id: "calendar", label: "Calendário" },
    { id: "mine", label: "Minhas inscrições" },
    { id: "past", label: "Anteriores" },
  ];

  const now = new Date();
  // Destaque só em "Próximos" sem filtro de categoria
  const highlight = tab === "upcoming" && !category ? events[0] : undefined;
  const agenda = highlight ? events.slice(1) : events;
  const months = groupByMonth(agenda);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Eventos</h1>
          <p className="text-sm text-slate-500">Eventos e atividades do hospital</p>
        </div>
        {canManageEventos && (
          <Link
            href="/intranet/eventos/novo"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus size={16} /> Novo evento
          </Link>
        )}
      </div>

      {/* Destaque do próximo evento */}
      {!loading && highlight && (
        <EventHighlight
          ev={highlight}
          status={eventStatus(highlight, now)}
          acting={acting === highlight.id}
          onAct={() => handleRegister(highlight)}
        />
      )}

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtro de categoria (não no calendário) */}
      {tab !== "calendar" && (
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                category === c.value
                  ? "border-primary/30 bg-accent font-semibold text-primary"
                  : "border-border bg-white text-slate-600 hover:border-primary/30 hover:text-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Calendário */}
      {tab === "calendar" && (
        <EventCalendar
          events={events}
          selectedMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          onDayClick={() => setTab("upcoming")}
        />
      )}

      {/* Agenda */}
      {tab !== "calendar" && (
        loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-slate-500">
            <CalendarDays size={44} strokeWidth={1.5} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-700">{category ? "Nenhum evento nesta categoria." : EMPTY[tab]}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {months.map(m => (
              <section key={m.key} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{m.label}</h2>
                {m.items.map(ev => (
                  <EventAgendaRow
                    key={ev.id}
                    ev={ev}
                    status={eventStatus(ev, now)}
                    acting={acting === ev.id}
                    onAct={() => handleRegister(ev)}
                  />
                ))}
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}
