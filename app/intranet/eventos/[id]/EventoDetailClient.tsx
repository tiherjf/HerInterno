"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Loader2, Users, UserCheck, Clock3, Download, Check, X,
} from "lucide-react";

interface Props {
  eventId: string;
  event: {
    max_slots: number;
    slots_used: number;
    registration_deadline: string | null;
    is_past: boolean;
  };
  initialReg: { checked_in: boolean } | null;
  initialWaitlist: { joined_at: string } | null;
  isOrganizer: boolean;
  userId: string;
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

export default function EventoDetailClient({
  eventId, event, initialReg, initialWaitlist, isOrganizer,
}: Props) {
  const [reg, setReg] = useState(initialReg);
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [slotsUsed, setSlotsUsed] = useState(event.slots_used);
  const [acting, setActing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loadingPart, setLoadingPart] = useState(false);
  const [togglingCheckin, setTogglingCheckin] = useState<string | null>(null);

  const isFull = slotsUsed >= event.max_slots;
  const deadlinePassed = event.registration_deadline
    ? new Date(event.registration_deadline) < new Date()
    : false;

  useEffect(() => {
    if (!isOrganizer) return;
    setLoadingPart(true);
    fetch(`/api/eventos/${eventId}/participantes`)
      .then(r => r.json())
      .then(d => {
        setParticipants(d.registrations ?? []);
        setWaiters(d.waitlist ?? []);
        setLoadingPart(false);
      });
  }, [eventId, isOrganizer]);

  async function handleRegister() {
    setActing(true);
    const isReg = !!reg || !!waitlist;
    const res = await fetch(`/api/eventos/${eventId}/inscrever`, {
      method: isReg ? "DELETE" : "POST",
    });
    const json = await res.json();
    if (res.ok) {
      if (isReg) {
        setReg(null);
        setWaitlist(null);
        setSlotsUsed(s => Math.max(0, s - 1));
      } else if (json.status === "waitlist") {
        setWaitlist({ joined_at: new Date().toISOString() });
      } else {
        setReg({ checked_in: false });
        setSlotsUsed(s => s + 1);
      }
    }
    setActing(false);
  }

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
    <div className="space-y-6">
      {/* Ação do usuário */}
      {!event.is_past && (
        <div className="flex items-center gap-3 p-4 rounded-xl border">
          {reg ? (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium flex-1">
              <CheckCircle size={16} />
              {reg.checked_in ? "Você fez check-in neste evento!" : "Você está inscrito neste evento."}
            </div>
          ) : waitlist ? (
            <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium flex-1">
              <Clock3 size={16} />
              Você está na lista de espera.
            </div>
          ) : (
            <div className="flex-1 text-sm text-muted-foreground">
              {isFull
                ? "Vagas esgotadas — você pode entrar na fila de espera."
                : deadlinePassed
                ? "Prazo de inscrição encerrado."
                : "Garanta sua vaga neste evento."}
            </div>
          )}
          <Button
            size="sm"
            variant={reg || waitlist ? "outline" : "default"}
            onClick={handleRegister}
            disabled={acting || (deadlinePassed && !reg && !waitlist)}
            className={reg || waitlist ? "border-red-300 text-red-700 hover:bg-red-50" : ""}
          >
            {acting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : reg ? "Cancelar inscrição"
              : waitlist ? "Sair da fila"
              : isFull ? "Entrar na fila"
              : "Inscrever-se"}
          </Button>
        </div>
      )}

      {/* Painel do organizador */}
      {isOrganizer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
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
            <div className="border rounded-lg overflow-hidden">
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
                        <div className="font-medium">{p.full_name}</div>
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
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {waiters.map((w, i) => (
                      <tr key={w.user_id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{w.full_name}</div>
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
      )}
    </div>
  );
}
