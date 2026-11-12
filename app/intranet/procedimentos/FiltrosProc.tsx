"use client";

import { User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampoBusca } from "@/components/ui-her/CampoBusca";
import { Chip } from "@/components/ui-her/Chip";
import type { FiltrosProc as Filtros } from "@/lib/procedimentos/filtro";
import type { TipoKey } from "@/lib/procedimentos/types";

export const UNIDADES_PROC = [
  { key: "Hospital", label: "Hospital" },
  { key: "Clínica da Criança", label: "Clínica da Criança" },
  { key: "Levy", label: "Instituto Levy" },
  { key: "Instituto", label: "Instituto" },
  { key: "Barão", label: "Barão" },
] as const;

export const TIPOS: { key: TipoKey; label: string; singular: string }[] = [
  { key: "exame", label: "Exames", singular: "Exame" },
  { key: "procedimento", label: "Procedimentos", singular: "Procedimento" },
];

const TODOS = "__todos__";

export function FiltrosProc({ filtros, onChange, medicos }: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  medicos: string[];
}) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });
  // Ao trocar de unidade o médico volta para "Todos" (a lista de médicos muda).
  const setUnidade = (u: string | null) => onChange({ ...filtros, unidade: u, medico: null });

  return (
    <div className="space-y-3">
      <CampoBusca
        value={filtros.busca}
        onChange={(v) => set("busca", v)}
        placeholder="Buscar nome, descrição, categoria ou médico..."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={filtros.unidade === null} onClick={() => setUnidade(null)}>Todas</Chip>
        {UNIDADES_PROC.map((u) => (
          <Chip key={u.key} ativo={filtros.unidade === u.key} onClick={() => setUnidade(u.key)}>{u.label}</Chip>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Chip ativo={filtros.tipo === null} onClick={() => set("tipo", null)}>Todos</Chip>
        {TIPOS.map((t) => (
          <Chip key={t.key} ativo={filtros.tipo === t.key} onClick={() => set("tipo", t.key)}>{t.label}</Chip>
        ))}

        {medicos.length > 0 && (
          <Select value={filtros.medico ?? TODOS} onValueChange={(v) => set("medico", v === TODOS ? null : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[11rem] gap-1 rounded-full text-xs" aria-label="Médico">
              <User size={13} className="text-muted-foreground" />
              <SelectValue placeholder="Médico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Médico: Todos</SelectItem>
              {medicos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
