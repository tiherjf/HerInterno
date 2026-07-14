"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Lock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DayJustification {
  id: string;
  status: string;
  type_name: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface CalendarDay {
  date: string;
  day: number;
  weekend: boolean;
  dow: number;
  justifications: DayJustification[];
}

interface Fechamento {
  id: string;
  closed_by_name: string;
  closed_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:           { label: "Ag. Gestor",  bg: "bg-yellow-100",  text: "text-yellow-800", dot: "bg-yellow-400" },
  manager_approved:  { label: "Ag. RH",      bg: "bg-blue-100",    text: "text-blue-800",   dot: "bg-blue-400" },
  approved:          { label: "Aprovada",    bg: "bg-green-100",   text: "text-green-800",  dot: "bg-green-500" },
  manager_rejected:  { label: "Recusada",    bg: "bg-red-100",     text: "text-red-800",    dot: "bg-red-400" },
  rejected:          { label: "Recusada",    bg: "bg-red-100",     text: "text-red-800",    dot: "bg-red-400" },
  cancelled:         { label: "Cancelada",   bg: "bg-gray-100",    text: "text-gray-600",   dot: "bg-gray-400" },
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function addMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarioPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ponto/calendario?month=${month}`);
      const json = await res.json();
      setDays(json.days ?? []);
      setFechamento(json.fechamento ?? null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Offset: primeiro dia do mês cai em qual coluna? (0=Dom)
  const firstDow = days[0]?.dow ?? 0;
  const totalCells = firstDow + days.length;
  const rows = Math.ceil(totalCells / 7);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Calendário de Ponto</h1>
          <p className="text-sm text-muted-foreground">Visualize suas justificativas por mês</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(m => addMonth(m, -1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-semibold capitalize min-w-[150px] text-center">
            {monthLabel(month)}
          </span>
          <Button variant="outline" size="sm" onClick={() => setMonth(m => addMonth(m, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Aviso de período fechado */}
      {fechamento && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          <Lock size={15} />
          <span>
            Período fechado por <strong>{fechamento.closed_by_name}</strong> em{" "}
            {new Date(fechamento.closed_at).toLocaleDateString("pt-BR")}. Novas justificativas não são permitidas.
          </span>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).filter(([k]) => ["pending","manager_approved","approved","manager_rejected"].includes(k)).map(([, cfg]) => (
          <div key={cfg.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className="text-gray-600">{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
          <span className="text-gray-600">Fim de semana</span>
        </div>
      </div>

      {/* Calendário */}
      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b">
            {DOW_LABELS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-semibold ${i === 0 || i === 6 ? "text-red-400" : "text-gray-500"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7">
            {Array.from({ length: rows * 7 }).map((_, idx) => {
              const dayIdx = idx - firstDow;
              const day = dayIdx >= 0 && dayIdx < days.length ? days[dayIdx] : null;

              if (!day) {
                return <div key={idx} className="min-h-[56px] sm:min-h-[80px] border-b border-r last:border-r-0 bg-gray-50/30" />;
              }

              const isToday = day.date === today;
              const hasJust = day.justifications.length > 0;

              return (
                <div
                  key={day.date}
                  onClick={() => hasJust && setSelectedDay(day)}
                  className={`min-h-[56px] sm:min-h-[80px] border-b border-r last:border-r-0 p-1 sm:p-2 flex flex-col gap-1 transition-colors ${
                    day.weekend ? "bg-gray-50" : "bg-white"
                  } ${hasJust ? "cursor-pointer hover:bg-blue-50/50" : ""}`}
                >
                  {/* Número do dia */}
                  <span className={`text-xs sm:text-sm font-medium w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${
                    isToday ? "bg-primary text-primary-foreground" : day.weekend ? "text-gray-400" : "text-gray-700"
                  }`}>
                    {day.day}
                  </span>

                  {/* Chips de justificativa */}
                  {day.justifications.map(j => {
                    const cfg = STATUS_CONFIG[j.status] ?? STATUS_CONFIG.pending;
                    return (
                      <Badge
                        key={j.id}
                        className={`text-[10px] leading-tight px-1.5 py-0 rounded font-medium truncate border-0 ${cfg.bg} ${cfg.text}`}
                        title={`${j.type_name} — ${cfg.label}`}
                      >
                        {j.type_name}
                      </Badge>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: detalhe do dia */}
      <Dialog open={!!selectedDay} onOpenChange={v => !v && setSelectedDay(null)}>
        <DialogContent>
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays size={18} />
                  {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {selectedDay.justifications.map(j => {
                  const cfg = STATUS_CONFIG[j.status] ?? STATUS_CONFIG.pending;
                  return (
                    <div key={j.id} className={`rounded-lg p-4 ${cfg.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold text-sm ${cfg.text}`}>{j.type_name}</span>
                        <Badge className={`text-xs border ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      {j.is_full_day ? (
                        <p className="text-xs text-gray-600">Dia todo</p>
                      ) : (
                        <p className="text-xs text-gray-600">{j.start_time} – {j.end_time}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
