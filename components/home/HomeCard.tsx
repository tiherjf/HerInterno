import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Moldura dos cartões da página inicial (título com ícone + link opcional). */
export function HomeCard({
  title,
  icon: Icon,
  href,
  hrefLabel = "Ver todos",
  children,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon size={16} className="text-primary" /> {title}
        </h3>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {hrefLabel} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
