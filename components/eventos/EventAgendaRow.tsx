"use client";

import Link from "next/link";
import { DateBlock } from "@/components/ui-her/DateBlock";
import { EventAction } from "./EventAction";
import { SlotsBar } from "./SlotsBar";
import { categoryLabel, eventPlace, eventTime } from "@/lib/eventos/labels";
import type { EventStatus } from "@/lib/eventos/status";

/** Evento como vem de GET /api/eventos (com o estado do usuário). */
export interface ListEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  registration_deadline: string | null;
  max_slots: number | null;
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

/** Linha da agenda: bloco de data, categoria, hora/local, título, vagas e ação. */
export function EventAgendaRow({
  ev,
  status,
  acting,
  onAct,
}: {
  ev: ListEvent;
  status: EventStatus;
  acting: boolean;
  onAct: () => void;
}) {
  const place = eventPlace(ev);
  const upcoming = status !== "ended" && status !== "participated";
  return (
    <Link
      href={`/intranet/eventos/${ev.id}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <DateBlock iso={ev.event_date} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-primary">{categoryLabel(ev.category)}</span>
          {ev.is_mandatory && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">Obrigatório</span>
          )}
          <span>
            {eventTime(ev.event_date)}
            {place ? ` · ${place}` : ""}
          </span>
        </div>
        <p className="mt-1 truncate font-semibold text-slate-900 group-hover:text-primary">{ev.title}</p>
        {upcoming && <SlotsBar used={ev.slots_used} max={ev.max_slots} className="mt-2 max-w-xs" />}
      </div>
      <EventAction status={status} acting={acting} onAct={onAct} className="hidden sm:inline-flex" />
    </Link>
  );
}
