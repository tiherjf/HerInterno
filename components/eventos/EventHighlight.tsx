"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { CoverImage } from "@/components/ui-her/CoverImage";
import { EventAction } from "./EventAction";
import { SlotsBar } from "./SlotsBar";
import type { ListEvent } from "./EventAgendaRow";
import { categoryLabel, eventLongDate, eventPlace, eventTime } from "@/lib/eventos/labels";
import { relativeDaysLabel } from "@/lib/eventos/dates";
import type { EventStatus } from "@/lib/eventos/status";

/** O próximo evento, em destaque grande no topo da aba "Próximos". */
export function EventHighlight({
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
  const rel = relativeDaysLabel(ev.event_date, new Date());
  const place = eventPlace(ev);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card md:flex md:h-80">
      <Link href={`/intranet/eventos/${ev.id}`} className="block md:h-full md:w-[42%] md:shrink-0">
        {ev.cover_url ? (
          <CoverImage src={ev.cover_url} alt={ev.title} className="h-56 md:h-full" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-accent text-primary md:h-full">
            <CalendarDays size={48} strokeWidth={1.5} />
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden p-5 md:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Próximo evento{rel ? ` · ${rel}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">
            {categoryLabel(ev.category)}
          </span>
          {ev.is_mandatory && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Obrigatório</span>
          )}
        </div>
        <Link href={`/intranet/eventos/${ev.id}`} className="hover:text-primary">
          <h2 className="text-xl font-bold leading-tight text-slate-900 md:text-2xl">{ev.title}</h2>
        </Link>
        <p className="text-sm text-slate-600">
          {eventLongDate(ev.event_date)} · {eventTime(ev.event_date)}
          {place ? ` · ${place}` : ""}
        </p>
        {ev.description && <p className="line-clamp-2 text-sm text-slate-500">{ev.description}</p>}
        <SlotsBar used={ev.slots_used} max={ev.max_slots} className="mt-1 max-w-sm" />
        <div className="mt-auto flex items-center gap-3 pt-3">
          <EventAction status={status} acting={acting} onAct={onAct} />
          <Link href={`/intranet/eventos/${ev.id}`} className="text-sm font-medium text-primary hover:underline">
            Ver detalhes
          </Link>
        </div>
      </div>
    </div>
  );
}
