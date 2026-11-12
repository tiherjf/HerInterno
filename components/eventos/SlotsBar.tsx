import { cn } from "@/lib/utils";
import { isUnlimited } from "@/lib/eventos/status";

/** Barra de vagas ("32 de 40 vagas"). Não aparece para evento sem limite. */
export function SlotsBar({ used, max, className }: { used: number; max: number | null; className?: string }) {
  if (isUnlimited(max) || (max as number) <= 0) return null;
  const total = max as number;
  const pct = Math.min(100, Math.max(0, (used / total) * 100));
  const full = used >= total;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", full ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        {full ? "Vagas esgotadas" : `${Math.min(used, total)} de ${total} vagas`}
      </p>
    </div>
  );
}
