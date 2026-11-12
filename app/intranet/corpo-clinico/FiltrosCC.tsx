"use client";

import { Clock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampoBusca } from "@/components/ui-her/CampoBusca";
import { Chip } from "@/components/ui-her/Chip";
import { TURNO_LABEL, type Turno } from "@/components/corpo-clinico/agenda";
import type { FiltrosCC as Filtros } from "@/lib/corpo-clinico/filtro";

export const UNIDADES_CC = [
  { key: "Hospital", label: "Hospital" },
  { key: "Clínica da Criança", label: "Clínica da Criança" },
  { key: "Levy", label: "Instituto Levy" },
  { key: "Barão", label: "Barão" },
  { key: "Instituto", label: "Instituto" },
] as const;

const TURNOS: Turno[] = ["manha", "tarde", "noite"];
const TODAS = "__todas__";

export function FiltrosCC({ filtros, onChange, grupos, convenios, temFiltro, onLimpar }: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  grupos: string[];
  convenios: string[];
  temFiltro: boolean;
  onLimpar: () => void;
}) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });
  const alternarTurno = (t: Turno) =>
    set("turnos", filtros.turnos.includes(t) ? filtros.turnos.filter((x) => x !== t) : [...filtros.turnos, t]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <CampoBusca
          className="sm:flex-[2]"
          value={filtros.busca}
          onChange={(v) => set("busca", v)}
          placeholder="Buscar médico, especialidade, dia..."
        />
        <CampoBusca
          className="sm:flex-1"
          icone={ShieldCheck}
          value={filtros.convenio}
          onChange={(v) => set("convenio", v)}
          placeholder="Convênio (ex.: unimed)"
          ariaLabel="Convênio"
          list="convenios-cc"
        />
        <datalist id="convenios-cc">
          {convenios.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip ativo={filtros.unidade === null} onClick={() => set("unidade", null)}>Todas</Chip>
        {UNIDADES_CC.map((u) => (
          <Chip key={u.key} ativo={filtros.unidade === u.key} onClick={() => set("unidade", filtros.unidade === u.key ? null : u.key)}>
            {u.label}
          </Chip>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Chip ativo={filtros.hoje} onClick={() => set("hoje", !filtros.hoje)} className="inline-flex items-center gap-1">
          <Clock size={12} /> Hoje
        </Chip>
        {TURNOS.map((t) => (
          <Chip key={t} ativo={filtros.turnos.includes(t)} onClick={() => alternarTurno(t)}>{TURNO_LABEL[t]}</Chip>
        ))}

        <Select value={filtros.grupo ?? TODAS} onValueChange={(v) => set("grupo", v === TODAS ? null : v)}>
          <SelectTrigger className="h-8 w-auto min-w-[11rem] rounded-full text-xs" aria-label="Especialidade">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as especialidades</SelectItem>
            {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={onLimpar} className="h-8 text-slate-500">
            <X size={14} /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
