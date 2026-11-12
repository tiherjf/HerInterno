import { cn } from "@/lib/utils";

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(new Date(iso));

/** Bloco de data (dia grande + mês curto) usado na página inicial e na agenda de eventos. */
export function DateBlock({ iso, size = "sm", className }: { iso: string; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 flex-col items-center rounded-lg bg-slate-100 leading-tight text-primary",
        size === "md" ? "w-14 py-1.5" : "w-11 py-1",
        className
      )}
    >
      <span className={cn("font-bold", size === "md" ? "text-xl" : "text-base")}>
        {fmt(iso, { day: "2-digit" })}
      </span>
      <span className={cn("font-semibold uppercase", size === "md" ? "text-[11px]" : "text-[10px]")}>
        {fmt(iso, { month: "short" }).replace(".", "")}
      </span>
    </span>
  );
}
