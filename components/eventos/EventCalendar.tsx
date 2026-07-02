"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_COLORS: Record<string, string> = {
  palestra: "bg-blue-500",
  treinamento: "bg-green-500",
  confraternizacao: "bg-pink-500",
  comemoracao: "bg-yellow-500",
  curso: "bg-purple-500",
  outro: "bg-gray-400",
};

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  category: string;
}

interface Props {
  events: CalendarEvent[];
  onDayClick?: (date: string) => void;
  selectedMonth?: string; // YYYY-MM
  onMonthChange?: (month: string) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function EventCalendar({ events, onDayClick, selectedMonth, onMonthChange }: Props) {
  const today = new Date();
  const [current, setCurrent] = useState<{ year: number; month: number }>(() => {
    if (selectedMonth) {
      const [y, m] = selectedMonth.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  function navigate(dir: -1 | 1) {
    setCurrent(c => {
      let m = c.month + dir;
      let y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      const next = { year: y, month: m };
      onMonthChange?.(`${y}-${String(m + 1).padStart(2, "0")}`);
      return next;
    });
  }

  const firstDay = new Date(current.year, current.month, 1);
  const lastDay = new Date(current.year, current.month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun

  const days: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (days.length % 7 !== 0) days.push(null);

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    const d = new Date(ev.event_date);
    if (d.getFullYear() === current.year && d.getMonth() === current.month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    current.month === today.getMonth() &&
    current.year === today.getFullYear();

  function handleDayClick(day: number) {
    const dateStr = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onDayClick?.(dateStr);
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <span className="font-semibold text-sm">
          {MONTHS[current.month]} {current.year}
        </span>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const evs = day ? (eventsByDay[day] ?? []) : [];
          const todayClass = day && isToday(day) ? "bg-primary text-primary-foreground rounded-full" : "";
          return (
            <div
              key={i}
              className={`min-h-16 p-1 border-b border-r last-of-type:border-r-0 ${day ? "cursor-pointer hover:bg-muted/40" : "bg-muted/20"}`}
              onClick={() => day && handleDayClick(day)}
            >
              {day && (
                <>
                  <div className={`w-7 h-7 flex items-center justify-center text-sm font-medium mb-1 mx-auto ${todayClass}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className={`text-xs text-white rounded px-1 truncate ${CATEGORY_COLORS[ev.category] ?? "bg-gray-400"}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {evs.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-1">+{evs.length - 3}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t bg-muted/20">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {cat.charAt(0).toUpperCase() + cat.slice(1).replace("confraternizacao", "Confraternização").replace("comemoracao", "Comemoração")}
          </div>
        ))}
      </div>
    </div>
  );
}
