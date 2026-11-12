import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { HomeCard } from "./HomeCard";
import { DateBlock } from "@/components/ui-her/DateBlock";

export interface HomeEvent {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(new Date(iso));

export function UpcomingEventsCard({ events }: { events: HomeEvent[] }) {
  return (
    <HomeCard title="Próximos eventos" icon={CalendarDays} href="/intranet/eventos">
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum evento agendado.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link href={`/intranet/eventos/${ev.id}`} className="group flex items-center gap-3">
                <DateBlock iso={ev.event_date} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-primary">
                    {ev.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {fmt(ev.event_date, { hour: "2-digit", minute: "2-digit" })}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}
