"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EventCalendar from "@/components/eventos/EventCalendar";
import {
  Calendar, MapPin, Users, Clock, Loader2, CheckCircle,
  Plus, Video, Building2, Clock3, History, Star, ListFilter,
} from "lucide-react";

const CATEGORIES = [
  { value: "", label: "Todas" },
  { value: "palestra", label: "Palestra" },
  { value: "treinamento", label: "Treinamento" },
  { value: "confraternizacao", label: "Confraternização" },
  { value: "comemoracao", label: "Comemoração" },
  { value: "curso", label: "Curso" },
  { value: "outro", label: "Outro" },
];

const TYPE_LABELS: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
};

const CAT_COLORS: Record<string, string> = {
  palestra: "bg-blue-100 text-blue-800",
  treinamento: "bg-green-100 text-green-800",
  confraternizacao: "bg-pink-100 text-pink-800",
  comemoracao: "bg-yellow-100 text-yellow-800",
  curso: "bg-purple-100 text-purple-800",
  outro: "bg-gray-100 text-gray-700",
};

type Tab = "upcoming" | "calendar" | "mine" | "past";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  event_date: string;
  registration_deadline: string;
  max_slots: number;
  slots_used: number;
  cover_url: string | null;
  category: string;
  type: string;
  meeting_link: string | null;
  is_mandatory: boolean;
  is_registered: boolean;
  checked_in: boolean;
  on_waitlist: boolean;
}

interface UserProfile {
  role: string;
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function canManage(role: string) {
  return ["admin", "ti", "marketing"].includes(role);
}

export default function EventosPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [category, setCategory] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("view", tab === "calendar" ? "all" : tab === "mine" ? "upcoming" : tab);
    if (category) params.set("category", category);
    if (tab === "calendar") params.set("month", calendarMonth);

    const res = await fetch(`/api/eventos?${params}`);
    const json = await res.json();
    let evs: Event[] = json.events ?? [];
    if (tab === "mine") evs = evs.filter(e => e.is_registered || e.on_waitlist);
    setEvents(evs);
    setLoading(false);
  }, [tab, category, calendarMonth]);

  useEffect(() => {
    fetch("/api/perfil").then(r => r.json()).then(d => setProfile(d));
  }, []);

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

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "upcoming", label: "Próximos", icon: <Calendar size={15} /> },
    { id: "calendar", label: "Calendário", icon: <ListFilter size={15} /> },
    { id: "mine", label: "Meus Eventos", icon: <Star size={15} /> },
    { id: "past", label: "Histórico", icon: <History size={15} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Eventos</h2>
          <p className="text-muted-foreground text-sm mt-1">Eventos e atividades do hospital</p>
        </div>
        {profile && canManage(profile.role) && (
          <Link href="/intranet/eventos/novo">
            <Button size="sm">
              <Plus size={15} className="mr-1.5" /> Novo Evento
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
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
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                category === c.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Calendar view */}
      {tab === "calendar" && (
        <EventCalendar
          events={events}
          selectedMonth={calendarMonth}
          onMonthChange={setCalendarMonth}
          onDayClick={date => {
            setTab("upcoming");
          }}
        />
      )}

      {/* List view */}
      {tab !== "calendar" && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={36} />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum evento encontrado</p>
              <p className="text-sm mt-1">
                {tab === "mine" ? "Você não está inscrito em nenhum evento." : "Tente outro filtro."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.map(ev => {
                const isFull = ev.slots_used >= ev.max_slots;
                const deadlinePassed = ev.registration_deadline
                  ? new Date(ev.registration_deadline) < new Date()
                  : false;
                const canRegister = !isFull && !deadlinePassed && !ev.is_registered && !ev.on_waitlist;
                const slotsLeft = ev.max_slots - ev.slots_used;
                const fillPct = Math.min((ev.slots_used / ev.max_slots) * 100, 100);

                return (
                  <div
                    key={ev.id}
                    className={`rounded-xl border overflow-hidden flex flex-col ${
                      ev.is_registered ? "border-green-300" : ev.on_waitlist ? "border-yellow-300" : ""
                    }`}
                  >
                    {/* Cover */}
                    {ev.cover_url && (
                      <Link href={`/intranet/eventos/${ev.id}`}>
                        <div className="aspect-video bg-muted overflow-hidden">
                          <img src={ev.cover_url} alt={ev.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                        </div>
                      </Link>
                    )}

                    <div className="p-4 flex flex-col gap-3 flex-1">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[ev.category] ?? "bg-gray-100 text-gray-700"}`}>
                          {ev.category.charAt(0).toUpperCase() + ev.category.slice(1)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {TYPE_LABELS[ev.type] ?? ev.type}
                        </span>
                        {ev.is_mandatory && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            Obrigatório
                          </span>
                        )}
                        {ev.is_registered && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium flex items-center gap-1">
                            <CheckCircle size={11} /> Inscrito
                          </span>
                        )}
                        {ev.on_waitlist && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                            Fila de espera
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link href={`/intranet/eventos/${ev.id}`} className="hover:underline">
                        <h3 className="font-semibold text-base leading-snug">{ev.title}</h3>
                      </Link>

                      {ev.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{ev.description}</p>
                      )}

                      {/* Meta */}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} />
                          <span>{formatDT(ev.event_date)}</span>
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={13} />
                            <span>{ev.location}</span>
                          </div>
                        )}
                        {ev.meeting_link && (
                          <div className="flex items-center gap-2">
                            <Video size={13} />
                            <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                              Link da reunião
                            </a>
                          </div>
                        )}
                        {ev.registration_deadline && (
                          <div className="flex items-center gap-2">
                            <Clock size={13} />
                            <span>Inscrições até {formatDate(ev.registration_deadline)}</span>
                          </div>
                        )}
                      </div>

                      {/* Vagas */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users size={13} />
                            {ev.slots_used}/{ev.max_slots} inscritos
                          </span>
                          <span className={`text-xs font-medium ${isFull ? "text-red-600" : "text-green-600"}`}>
                            {isFull ? "Esgotado" : `${slotsLeft} vaga${slotsLeft !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${fillPct > 80 ? "bg-red-500" : "bg-green-500"}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Ações */}
                      {tab !== "past" && (
                        <div className="flex gap-2 mt-auto pt-1">
                          {ev.is_registered || ev.on_waitlist ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => handleRegister(ev)}
                              disabled={acting === ev.id}
                            >
                              {acting === ev.id ? <Loader2 size={13} className="animate-spin" /> : ev.on_waitlist ? "Sair da fila" : "Cancelar inscrição"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={!canRegister || acting === ev.id}
                              onClick={() => handleRegister(ev)}
                              variant={isFull ? "outline" : "default"}
                            >
                              {acting === ev.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : isFull
                                ? "Entrar na fila"
                                : deadlinePassed
                                ? "Prazo encerrado"
                                : "Inscrever-se"}
                            </Button>
                          )}
                          <Link href={`/intranet/eventos/${ev.id}`}>
                            <Button variant="outline" size="sm">Ver</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
