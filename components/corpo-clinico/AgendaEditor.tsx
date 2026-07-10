"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { type AgendaEntry, DIAS_CURTOS } from "./agenda";

const INICIO_PADRAO = "08:00";
const FIM_PADRAO = "12:00";

interface AgendaEditorProps {
  value: AgendaEntry[];
  onChange: (agenda: AgendaEntry[]) => void;
}

/**
 * Editor estruturado de agenda: chips para os 7 dias da semana e faixa de
 * horário (início/fim) por dia selecionado, com atalho "mesmo horário para
 * todos os dias". Trabalha com uma faixa por dia.
 */
export function AgendaEditor({ value, onChange }: AgendaEditorProps) {
  const [mesmoHorario, setMesmoHorario] = useState(() => {
    const faixas = new Set(value.map(e => `${e.inicio}-${e.fim}`));
    return faixas.size <= 1;
  });

  const diasSelecionados = Array.from(new Set(value.map(e => e.dia))).sort((a, b) => a - b);

  const entradaDoDia = (dia: number) => value.find(e => e.dia === dia);

  const toggleDia = (dia: number) => {
    if (diasSelecionados.includes(dia)) {
      onChange(value.filter(e => e.dia !== dia));
    } else {
      const base = value[value.length - 1];
      const nova: AgendaEntry = {
        dia,
        inicio: base?.inicio ?? INICIO_PADRAO,
        fim: base?.fim ?? FIM_PADRAO,
      };
      onChange([...value, nova].sort((a, b) => a.dia - b.dia));
    }
  };

  const setHorario = (dia: number, campo: "inicio" | "fim", valor: string) => {
    if (mesmoHorario) {
      onChange(value.map(e => ({ ...e, [campo]: valor })));
    } else {
      onChange(value.map(e => (e.dia === dia ? { ...e, [campo]: valor } : e)));
    }
  };

  const toggleMesmoHorario = (ativo: boolean) => {
    setMesmoHorario(ativo);
    if (ativo && value.length > 1) {
      const base = value[0];
      onChange(value.map(e => ({ ...e, inicio: base.inicio, fim: base.fim })));
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1">
        <Clock size={13} /> Agenda de atendimento
      </Label>

      <div className="flex flex-wrap gap-1.5">
        {DIAS_CURTOS.map((nome, dia) => {
          const ativo = diasSelecionados.includes(dia);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => toggleDia(dia)}
              aria-pressed={ativo}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                ativo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {nome}
            </button>
          );
        })}
      </div>

      {diasSelecionados.length === 0 && (
        <p className="text-xs text-muted-foreground">Selecione os dias de atendimento acima.</p>
      )}

      {diasSelecionados.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="mesmo_horario"
              checked={mesmoHorario}
              onCheckedChange={v => toggleMesmoHorario(v === true)}
            />
            <Label htmlFor="mesmo_horario" className="text-sm font-normal cursor-pointer">
              Mesmo horário para todos os dias
            </Label>
          </div>

          {mesmoHorario ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                className="w-32"
                value={value[0]?.inicio ?? INICIO_PADRAO}
                onChange={e => setHorario(-1, "inicio", e.target.value)}
              />
              <span className="text-sm text-muted-foreground">às</span>
              <Input
                type="time"
                className="w-32"
                value={value[0]?.fim ?? FIM_PADRAO}
                onChange={e => setHorario(-1, "fim", e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {diasSelecionados.map(dia => {
                const entrada = entradaDoDia(dia);
                if (!entrada) return null;
                return (
                  <div key={dia} className="flex items-center gap-2">
                    <span className="w-10 text-sm font-medium text-muted-foreground shrink-0">
                      {DIAS_CURTOS[dia]}
                    </span>
                    <Input
                      type="time"
                      className="w-32"
                      value={entrada.inicio}
                      onChange={e => setHorario(dia, "inicio", e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">às</span>
                    <Input
                      type="time"
                      className="w-32"
                      value={entrada.fim}
                      onChange={e => setHorario(dia, "fim", e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
