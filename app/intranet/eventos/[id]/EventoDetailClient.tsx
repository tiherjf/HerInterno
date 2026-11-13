"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Loader2, Users, UserCheck, Clock3, Download, Check,
} from "lucide-react";
import { BotaoMensagem } from "@/components/chat/BotaoMensagem";
import { SlotsBar } from "@/components/eventos/SlotsBar";
import { afterRegistrationChange, isUnlimited } from "@/lib/eventos/status";

interface Props {
  eventId: string;
  event: {
    max_slots: number | null;
    slots_used: number;
    registration_deadline: string | null;
    is_past: boolean;
  };
  initialReg: { checked_in: boolean } | null;
  initialWaitlist: { joined_at: string } | null;
  isOrganizer: boolean;
  userId: string;
  waitlistCount: number;
}

interface Participant {
  user_id: string;
  full_name: string;
  sector: string;
  role: string;
  registered_at: string;
  checked_in: boolean;
  checked_in_at: string | null;
}

interface Waiter {
  user_id: string;
  full_name: string;
  sector: string;
  joined_at: string;
}

/** Quadro de inscrição (lateral do evento aberto). */
export default function EventoDetailClient({
  eventId, event, initialReg, initialWaitlist, waitlistCount,
}: Props) {
  const [reg, setReg] = useState(initialReg);
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [slotsUsed, setSlotsUsed] = useState(event.slots_used);
  const [queue, setQueue] = useState(waitlistCount);
  const [acting, setActing] = useState(false);

  const isFull = !isUnlimited(event.max_slots) && slotsUsed >= (event.max_slots as number);
  const deadlinePassed = event.registration_deadline
    ? new Date(event.registration_deadline) < new Date()
    : false;

  async function handleRegister() {
    setActing(true);
    const isReg = !!reg || !!waitlist;
    const res = await fetch(`/api/eventos/${eventId}/inscrever`, {
      method: isReg ? "DELETE" : "POST",
    });
    const json = await res.json();
    if (res.ok && json.status) {
      const next = afterRegistrationChange(
        { registered: !!reg, waitlisted: !!waitlist, slotsUsed, waitlistCount: queue },
        json.status
      );
      setReg(next.registered ? reg ?? { checked_in: false } : null);
      setWaitlist(next.waitlisted ? waitlist ?? { joined_at: new Date().toISOString() } : null);
      setSlotsUsed(next.slotsUsed);
      setQueue(next.waitlistCount);
    }
    setActing(false);
  }

  const countLine = (
    <p className="flex items-center gap-1.5 text-sm text-slate-600">
      <Users size={14} className="text-primary" />
      {slotsUsed} {slotsUsed === 1 ? "inscrito" : "inscritos"}
      {queue > 0 ? ` · ${queue} na fila` : ""}
    </p>
  );

  // Evento que já aconteceu: sem botão
  if (event.is_past) {
    return (
      <div className="space-y-3">
        {countLine}
        <div className="rounded-lg bg-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-slate-600">
          Evento encerrado
        </div>
        {reg && (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
            <CheckCircle2 size={15} /> Você participou
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SlotsBar used={slotsUsed} max={event.max_slots} />
      {countLine}

      {reg ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
          <CheckCircle2 size={15} />
          {reg.checked_in ? "Você fez check-in neste evento!" : "Você está inscrito."}
        </p>
      ) : waitlist ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
          <Clock3 size={15} /> Você está na lista de espera.
        </p>
      ) : isFull && !deadlinePassed ? (
        <p className="text-sm text-slate-500">Vagas esgotadas: entre na fila de espera.</p>
      ) : null}

      {!reg && !waitlist && deadlinePassed ? (
        <div className="rounded-lg bg-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-slate-500">
          Inscrições encerradas
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRegister}
          disabled={acting}
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
            reg || waitlist
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              : isFull
              ? "border border-primary/30 bg-white text-primary hover:bg-accent"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {acting && <Loader2 size={15} className="animate-spin" />}
          {reg ? "Cancelar inscrição" : waitlist ? "Sair da fila" : isFull ? "Entrar na fila" : "Inscrever-se"}
        </button>
      )}
    </div>
  );
}

/** Lista de inscritos, fila e check-in: só para quem organiza eventos. */
export function ParticipantesPanel({ eventId, userId }: { eventId: string; userId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loadingPart, setLoadingPart] = useState(false);
  const [togglingCheckin, setTogglingCheckin] = useState<string | null>(null);


  useEffect(() => {
    setLoadingPart(true);
    fetch(`/api/eventos/${eventId}/participantes`)
      .then(r => r.json())
      .then(d => {
        setParticipants(d.registrations ?? []);
        setWaiters(d.waitlist ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingPart(false));
  }, [eventId]);

  async function toggleCheckin(userId: string, current: boolean) {
    setTogglingCheckin(userId);
    const res = await fetch(`/api/eventos/${eventId}/participantes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, checked_in: !current }),
    });
    if (res.ok) {
      setParticipants(prev => prev.map(p =>
        p.user_id === userId
          ? { ...p, checked_in: !current, checked_in_at: !current ? new Date().toISOString() : null }
          : p
      ));
    }
    setTogglingCheckin(null);
  }

  function downloadCSV() {
    window.open(`/api/eventos/${eventId}/participantes?format=csv`, "_blank");
  }

  const checkedInCount = participants.filter(p => p.checked_in).length;

  return (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="font-semibold text-base">
              Participantes ({participants.length})
              {participants.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · {checkedInCount} com check-in
                </span>
              )}
            </h3>
            <Button variant="outline" size="sm" onClick={downloadCSV}>
              <Download size={14} className="mr-1.5" /> Exportar CSV
            </Button>
          </div>

          {loadingPart ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              Nenhum inscrito ainda.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                    <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Setor</th>
                    <th className="text-center px-4 py-2.5 font-medium">Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, i) => (
                    <tr key={p.user_id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 font-medium">
                          {p.full_name}
                          <BotaoMensagem profileId={p.user_id} nome={p.full_name} meuId={userId} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {p.sector}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => toggleCheckin(p.user_id, p.checked_in)}
                          disabled={togglingCheckin === p.user_id}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                            p.checked_in
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                          title={p.checked_in ? "Remover check-in" : "Registrar check-in"}
                        >
                          {togglingCheckin === p.user_id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : p.checked_in ? (
                            <Check size={13} />
                          ) : (
                            <UserCheck size={13} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fila de espera */}
          {waiters.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">
                Fila de espera ({waiters.length})
              </h4>
              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {waiters.map((w, i) => (
                      <tr key={w.user_id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 font-medium">
                            {w.full_name}
                            <BotaoMensagem profileId={w.user_id} nome={w.full_name} meuId={userId} />
                          </div>
                          <div className="text-xs text-muted-foreground">{w.sector}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          #{i + 1} na fila
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
  );
}
