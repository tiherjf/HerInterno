"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Calendar, MapPin, Users, Clock, Loader2, CheckCircle } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  event_date: string;
  registration_deadline: string;
  max_slots: number;
  slots_used: number;
  active: boolean;
}

export default function EventosPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: evs } = await supabase
        .from("events")
        .select("*")
        .eq("active", true)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true });
      setEvents(evs || []);

      const { data: regs } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("user_id", user.id);
      setRegistrations(new Set(regs?.map((r) => r.event_id) || []));
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleRegister(eventId: string) {
    setRegistering(eventId);
    const { error } = await supabase.from("event_registrations").insert({
      event_id: eventId,
      user_id: userId,
    });

    if (!error) {
      setRegistrations((prev) => new Set(Array.from(prev).concat(eventId)));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, slots_used: e.slots_used + 1 } : e
        )
      );
    }
    setRegistering(null);
  }

  async function handleUnregister(eventId: string) {
    setRegistering(eventId);
    const { error } = await supabase
      .from("event_registrations")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (!error) {
      setRegistrations((prev) => new Set(Array.from(prev).filter((id) => id !== eventId)));
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, slots_used: Math.max(0, e.slots_used - 1) } : e
        )
      );
    }
    setRegistering(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Eventos</h2>
        <p className="text-muted-foreground">Inscreva-se nos próximos eventos do hospital</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Nenhum evento próximo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((ev) => {
            const isRegistered = registrations.has(ev.id);
            const isFull = ev.slots_used >= ev.max_slots;
            const deadlinePassed = new Date(ev.registration_deadline) < new Date();
            const canRegister = !isFull && !deadlinePassed;
            const slotsLeft = ev.max_slots - ev.slots_used;
            const fillPercent = (ev.slots_used / ev.max_slots) * 100;

            return (
              <Card key={ev.id} className={isRegistered ? "border-green-300 bg-green-50/30" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{ev.title}</CardTitle>
                    {isRegistered && (
                      <span className="shrink-0 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle size={12} /> Inscrito
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ev.description && (
                    <p className="text-sm text-muted-foreground">{ev.description}</p>
                  )}

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} />
                      <span>{formatDateTime(ev.event_date)}</span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin size={14} />
                        <span>{ev.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock size={14} />
                      <span>Inscrições até {formatDate(ev.registration_deadline)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users size={14} />
                        {ev.slots_used}/{ev.max_slots} inscritos
                      </span>
                      <span className={`text-xs font-medium ${isFull ? "text-red-600" : "text-green-600"}`}>
                        {isFull ? "Esgotado" : `${slotsLeft} vaga${slotsLeft !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${fillPercent > 80 ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(fillPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {isRegistered ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => handleUnregister(ev.id)}
                      disabled={registering === ev.id}
                    >
                      {registering === ev.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Cancelar Inscrição"
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!canRegister || registering === ev.id}
                      onClick={() => handleRegister(ev.id)}
                    >
                      {registering === ev.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isFull ? (
                        "Vagas Esgotadas"
                      ) : deadlinePassed ? (
                        "Prazo Encerrado"
                      ) : (
                        "Inscrever-se"
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
