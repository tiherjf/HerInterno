"use client";

import type { LucideIcon } from "lucide-react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo de busca no estilo A2, com ícone e botão de limpar. */
export function CampoBusca({
  value, onChange, placeholder, icone: Icone = Search, className, list, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icone?: LucideIcon;
  className?: string;
  list?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Icone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        list={list}
        className="h-10 w-full rounded-xl border border-border bg-white pl-9 pr-9 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
