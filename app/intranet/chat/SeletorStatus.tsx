"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Status } from "@/lib/chat-interno/tipos";
import { STATUS_META } from "./Avatar";

const ORDEM: Status[] = ["disponivel", "ausente", "ocupado"];

/** "Meu status" compacto: bolinha + rótulo, menu com os três status. */
export function SeletorStatus({ status, onMudar }: { status: Status; onMudar: (s: Status) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-3.5 text-sm font-medium text-slate-700 hover:border-primary/30"
        aria-label={`Meu status: ${STATUS_META[status].label}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].dot}`} />
        {STATUS_META[status].label}
        <ChevronDown size={14} className="text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Meu status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => onMudar(v as Status)}>
          {ORDEM.map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
