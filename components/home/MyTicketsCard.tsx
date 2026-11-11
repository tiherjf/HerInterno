import Link from "next/link";
import { Ticket } from "lucide-react";
import { HomeCard } from "./HomeCard";

export function MyTicketsCard({ openCount }: { openCount: number }) {
  return (
    <HomeCard title="Meus chamados" icon={Ticket} href="/intranet/chamados" hrefLabel="Ver">
      <div className="flex h-full flex-col justify-between gap-4">
        <p>
          <span className="text-3xl font-bold text-primary">{openCount}</span>{" "}
          <span className="text-sm text-slate-500">em andamento</span>
        </p>
        <Link
          href="/intranet/chamados"
          className="inline-flex w-max items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary/40 hover:text-primary"
        >
          Abrir novo chamado
        </Link>
      </div>
    </HomeCard>
  );
}
