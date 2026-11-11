import { Cake } from "lucide-react";
import { HomeCard } from "./HomeCard";
import type { Birthday } from "@/lib/home/greeting";

const MAX_SHOWN = 6;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function BirthdaysCard({ people, monthLabel }: { people: Birthday[]; monthLabel: string }) {
  const shown = people.slice(0, MAX_SHOWN);
  const rest = people.length - shown.length;
  return (
    <HomeCard title={`Aniversariantes de ${monthLabel}`} icon={Cake}>
      {people.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum aniversariante este mês.</p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(p.full_name)
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{p.full_name}</span>
              {p.isToday ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">Hoje</span>
              ) : (
                <span className="text-xs font-medium text-slate-500">dia {p.day}</span>
              )}
            </li>
          ))}
          {rest > 0 && <li className="text-xs text-slate-500">e mais {rest}</li>}
        </ul>
      )}
    </HomeCard>
  );
}
