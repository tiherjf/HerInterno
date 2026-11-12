import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Chip de filtro no estilo A2 (o mesmo de Notícias). */
export function Chip({ ativo, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { ativo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
        ativo
          ? "border-primary/30 bg-accent text-primary font-semibold"
          : "border-border bg-white text-slate-600 hover:border-primary/30 hover:text-primary",
        className,
      )}
      {...props}
    />
  );
}
