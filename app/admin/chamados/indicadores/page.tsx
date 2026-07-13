"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TicketCheck, Clock, CheckCircle2, Star, AlertTriangle,
  TrendingUp, Download, RefreshCw, ShieldCheck, Target,
  Timer, RotateCcw, Inbox, Printer, Users, CalendarClock,
} from "lucide-react";

interface KPIs {
  total: number;
  open: number;
  in_progress: number;
  waiting_user: number;
  waiting_third_party: number;
  resolved: number;
  critical_open: number;
  sla_compliance: number | null;
  resolution_rate: number | null;
  mtta: number | null;
  mttr: number | null;
  csat: number | null;
  rated_count: number;
  reopen_rate: number | null;
  reopened_count: number;
}

interface CategoryBar { name: string; color: string; count: number }
interface PriorityBar { label: string; key: string; count: number; color: string }
interface SectorBar { name: string; count: number }
interface MonthBar { month: string; count: number }
interface OnaData { numerator: number; denominator: number; result: number | null }
interface MonthOna { month: string; total: number; within: number; pct: number | null }
interface AgingBucket { label: string; count: number }
interface AgentRow {
  id: string;
  name: string;
  resolved: number;
  attended: number;
  mttr: number | null;
  csat: number | null;
  rated_count: number;
}
interface SlaBreakdown { within: number; breached: number; no_sla: number }
interface OlaData { within: number; total: number; pct: number | null }
interface BreachedTicket {
  number: number | null;
  title: string | null;
  team: string | null;
  assigned_name: string | null;
  resolved_at: string | null;
  sla_deadline: string | null;
  sla_breach_reason: string | null;
}
interface Previous {
  from: string;
  to: string;
  received: number;
  resolved: number;
  sla_compliance: number | null;
  mtta: number | null;
  mttr: number | null;
  csat: number | null;
  reopen_rate: number | null;
}

interface IndicatorsData {
  from: string;
  to: string;
  truncated: boolean;
  kpis: KPIs;
  ona: OnaData;
  sla: SlaBreakdown;
  ola: OlaData | null;
  breached_tickets: BreachedTicket[] | null;
  aging: { buckets: AgingBucket[]; waiting_user: number; waiting_third_party: number };
  by_agent: AgentRow[];
  heatmap: number[][];
  by_category: CategoryBar[];
  by_priority: PriorityBar[];
  by_sector: SectorBar[];
  monthly_volume: MonthBar[];
  monthly_ona: MonthOna[];
  previous: Previous;
}

const PERIODS = [
  { key: "month",    label: "Mês atual" },
  { key: "quarter",  label: "Trimestre" },
  { key: "semester", label: "Semestre" },
  { key: "year",     label: "Ano" },
];

const MONTHS_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12];

// Seleção de período: presets retrocompatíveis, mês específico ou "últimos N meses"
type PeriodSel =
  | { type: "preset"; key: string }
  | { type: "month"; value: string }   // YYYY-MM
  | { type: "months"; value: number }; // 1..24

function periodQuery(sel: PeriodSel): string {
  if (sel.type === "month") return `month=${sel.value}`;
  if (sel.type === "months") return `months=${sel.value}`;
  return `period=${sel.key}`;
}

function periodTag(sel: PeriodSel): string {
  if (sel.type === "month") return sel.value;
  if (sel.type === "months") return `ultimos-${sel.value}-meses`;
  return sel.key;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TEAM_LABELS: Record<string, string> = {
  ti: "TI",
  manutencao: "Manutenção",
  marketing: "Marketing",
};

function formatMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* Intervalo de datas resolvido pelo servidor. `to` é exclusivo (1º dia do mês
   seguinte quando ?month=...), então exibimos to − 1ms como fim inclusivo. */
function rangeLabel(from: string, to: string): string {
  return `${formatDate(from)} – ${new Date(new Date(to).getTime() - 1).toLocaleDateString("pt-BR")}`;
}

/* Delta ▲▼ vs período anterior.
   mode "relative": variação percentual; mode "points": diferença em pontos percentuais.
   lowerIsBetter inverte a semântica de cor (ex.: MTTA/MTTR/reabertura). */
function Delta({ current, previous, lowerIsBetter = false, mode = "relative" }: {
  current: number | null;
  previous: number | null;
  lowerIsBetter?: boolean;
  mode?: "relative" | "points";
}) {
  if (current === null || previous === null) {
    return <span className="text-[11px] text-muted-foreground">sem comparativo</span>;
  }
  const diff = current - previous;
  if (diff === 0 || (mode === "relative" && previous === 0)) {
    return <span className="text-[11px] text-gray-500">= período anterior</span>;
  }
  const up = diff > 0;
  const good = up !== lowerIsBetter;
  const label = mode === "points"
    ? `${Math.abs(Math.round(diff * 10) / 10)} p.p.`
    : `${Math.abs(Math.round((diff / previous) * 100))}%`;
  return (
    <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${good ? "text-green-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {label}
      <span className="font-normal text-muted-foreground ml-0.5">vs anterior</span>
    </span>
  );
}

function BarChart({ items, maxCount, colorFn }: {
  items: { label: string; count: number; color?: string }[];
  maxCount: number;
  colorFn?: (item: { label: string; count: number; color?: string }) => string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground py-4">Sem dados</p>;
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const bg = colorFn ? colorFn(item) : (item.color ?? "#3b82f6");
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-36 truncate shrink-0">{item.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: bg }}
              >
                {pct > 20 && (
                  <span className="text-xs text-white font-medium">{item.count}</span>
                )}
              </div>
            </div>
            <span className="text-xs font-medium text-gray-700 w-6 text-right">{item.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ icon, label, value, sublabel, delta, color = "blue", alert = false }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  delta?: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  alert?: boolean;
}) {
  const colors = {
    blue:   "bg-blue-50 text-blue-700",
    green:  "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red:    "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-red-300 bg-red-50" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`p-1.5 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</div>
      {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
      {delta && <div className="mt-1.5">{delta}</div>}
    </div>
  );
}

function Heatmap({ matrix }: { matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[3px] min-w-[560px]"
        style={{ gridTemplateColumns: "2.2rem repeat(24, minmax(0, 1fr))" }}
      >
        {/* Eixo de horas (a cada 3h) */}
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={`h${h}`} className="text-[9px] text-gray-400 text-center">
            {h % 3 === 0 ? `${h}h` : ""}
          </div>
        ))}
        {matrix.map((row, d) => (
          <div key={`row${d}`} className="contents">
            <div className="text-[10px] text-gray-500 flex items-center">{WEEKDAYS[d]}</div>
            {row.map((count, h) => (
              <div
                key={`${d}-${h}`}
                title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}h — ${count} chamado${count === 1 ? "" : "s"}`}
                className="aspect-square rounded-[3px] min-w-[14px]"
                style={{
                  backgroundColor: count > 0
                    ? `rgba(37, 99, 235, ${0.15 + 0.85 * (count / max)})`
                    : "#f3f4f6",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
        <span>Menos</span>
        {[0.15, 0.35, 0.6, 0.85, 1].map(a => (
          <div key={a} className="w-3.5 h-3.5 rounded-[3px]" style={{ backgroundColor: `rgba(37, 99, 235, ${a})` }} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}

/* Barra empilhada dentro × fora do prazo × sem SLA (resolvidos no período) */
function SlaBreakdownCard({ sla }: { sla: SlaBreakdown }) {
  const total = sla.within + sla.breached + sla.no_sla;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segments = [
    { label: "Dentro do prazo", count: sla.within, color: "#22c55e" },
    { label: "Fora do prazo", count: sla.breached, color: "#ef4444" },
    { label: "Sem SLA", count: sla.no_sla, color: "#9ca3af" },
  ];
  return (
    <div className="bg-white rounded-xl border p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
        <ShieldCheck size={16} className="text-gray-500" /> SLA — Dentro × Fora do Prazo
      </h2>
      <p className="text-[11px] text-muted-foreground mb-4">Chamados resolvidos no período</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Sem chamados resolvidos no período</p>
      ) : (
        <>
          <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
            {segments.filter(s => s.count > 0).map(s => (
              <div
                key={s.label}
                title={`${s.label}: ${s.count}`}
                className="h-full flex items-center justify-center transition-all duration-700"
                style={{ width: `${pct(s.count)}%`, backgroundColor: s.color }}
              >
                {pct(s.count) > 10 && (
                  <span className="text-[11px] text-white font-bold">{s.count}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {segments.map(s => (
              <span key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label}: <span className="font-semibold text-gray-900">{s.count}</span>
                {total > 0 && <span className="text-muted-foreground">({Math.round(pct(s.count))}%)</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function exportCSV(data: IndicatorsData, tag: string) {
  const q = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [
    ["Indicador", "Valor", "Período anterior"],
    ["Período", rangeLabel(data.from, data.to), rangeLabel(data.previous.from, data.previous.to)],
    ["Recebidos", data.kpis.total, data.previous.received],
    ["Resolvidos", data.kpis.resolved, data.previous.resolved],
    ["SLA no prazo (%)", data.kpis.sla_compliance ?? "N/A", data.previous.sla_compliance ?? "N/A"],
    ["Resolvidos dentro do prazo", data.sla.within, ""],
    ["Resolvidos fora do prazo", data.sla.breached, ""],
    ["Resolvidos sem SLA", data.sla.no_sla, ""],
    ...(data.ola && data.ola.total > 0
      ? [["OLA 1ª resposta (%)", data.ola.pct ?? "N/A", ""] as (string | number)[]]
      : []),
    ["Taxa de resolução (%)", data.kpis.resolution_rate ?? "N/A", ""],
    ["MTTA", formatMinutes(data.kpis.mtta), formatMinutes(data.previous.mtta)],
    ["MTTR", formatMinutes(data.kpis.mttr), formatMinutes(data.previous.mttr)],
    ["CSAT (1-5)", data.kpis.csat ?? "N/A", data.previous.csat ?? "N/A"],
    ["Taxa de reabertura (%)", data.kpis.reopen_rate ?? "N/A", data.previous.reopen_rate ?? "N/A"],
    ["Chamados avaliados", data.kpis.rated_count, ""],
    ["Críticos em aberto (agora)", data.kpis.critical_open, ""],
    ["Backlog aguardando usuário", data.aging.waiting_user, ""],
    ["Backlog aguardando terceiros", data.aging.waiting_third_party ?? 0, ""],
    ...data.aging.buckets.map(b => [`Backlog ${b.label}`, b.count, ""] as (string | number)[]),
    [],
    ["Categoria", "Chamados"],
    ...data.by_category.map(c => [c.name, c.count] as (string | number)[]),
    [],
    ["Agente", "Atendidos", "Resolvidos", "MTTR médio", "CSAT médio"],
    ...data.by_agent.map(a =>
      [a.name, a.attended, a.resolved, formatMinutes(a.mttr), a.csat ?? "N/A"] as (string | number)[]),
  ];

  if (data.breached_tickets) {
    rows.push(
      [],
      ["SLA estourado — Chamado", "Título", "Equipe", "Agente", "Resolvido em", "Prazo SLA", "Motivo do estouro"],
      ...data.breached_tickets.map(t => [
        t.number ?? "—",
        t.title ?? "—",
        t.team ? (TEAM_LABELS[t.team] ?? t.team) : "—",
        t.assigned_name ?? "—",
        formatDateTime(t.resolved_at),
        formatDateTime(t.sla_deadline),
        t.sla_breach_reason ?? "sem motivo registrado",
      ] as (string | number)[]),
    );
  }

  const csv = "﻿" + rows.map(r => r.map(q).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `indicadores_chamados_${tag}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IndicadoresPage() {
  const [sel, setSel] = useState<PeriodSel>({ type: "preset", key: "month" });
  const [data, setData] = useState<IndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chamados/indicadores?${periodQuery(sel)}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [sel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCat = data ? Math.max(...data.by_category.map(c => c.count), 1) : 1;
  const maxSector = data ? Math.max(...data.by_sector.map(s => s.count), 1) : 1;
  const maxPrio = data ? Math.max(...data.by_priority.map(p => p.count), 1) : 1;
  const maxMonth = data ? Math.max(...data.monthly_volume.map(m => m.count), 1) : 1;
  const maxAging = data ? Math.max(...data.aging.buckets.map(b => b.count), 1) : 1;

  const currentMonth = new Date().toISOString().slice(0, 7); // limite do <input type="month">

  return (
    <div className="space-y-6">
      {/* Estilos de impressão (Exportar PDF via window.print) */}
      <style>{`
        @media print {
          aside, header, .print-hide { display: none !important; }
          main { overflow: visible !important; padding: 0 !important; }
          body { background: #fff !important; }
          .rounded-xl, .rounded-lg { break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Indicadores de Chamados</h1>
          <p className="text-sm text-muted-foreground">Métricas para acompanhamento e acreditação ONA</p>
        </div>
        <div className="flex gap-2 print-hide">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          {data && (
            <>
              <Button variant="outline" size="sm" onClick={() => exportCSV(data, periodTag(sel))}>
                <Download size={16} /> Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer size={16} /> Exportar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Período: presets rápidos + mês específico + últimos N meses */}
      <div className="flex flex-wrap items-center gap-2 print-hide">
        {PERIODS.map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={sel.type === "preset" && sel.key === p.key ? "default" : "outline"}
            onClick={() => setSel({ type: "preset", key: p.key })}
          >
            {p.label}
          </Button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-200 hidden sm:block" />
        <input
          type="month"
          aria-label="Mês específico"
          max={currentMonth}
          value={sel.type === "month" ? sel.value : ""}
          onChange={e => { if (e.target.value) setSel({ type: "month", value: e.target.value }); }}
          className={`h-8 rounded-md border px-2.5 text-sm bg-white shadow-sm ${
            sel.type === "month" ? "border-gray-900 ring-1 ring-gray-900" : "border-input"
          }`}
        />
        <select
          aria-label="Últimos N meses"
          value={sel.type === "months" ? String(sel.value) : ""}
          onChange={e => { if (e.target.value) setSel({ type: "months", value: Number(e.target.value) }); }}
          className={`h-8 rounded-md border px-2.5 text-sm bg-white shadow-sm ${
            sel.type === "months" ? "border-gray-900 ring-1 ring-gray-900" : "border-input"
          }`}
        >
          <option value="">Últimos N meses…</option>
          {MONTHS_OPTIONS.map(n => (
            <option key={n} value={n}>{n === 1 ? "Último 1 mês" : `Últimos ${n} meses`}</option>
          ))}
        </select>
        {data && !loading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-1">
            <CalendarClock size={13} />
            {rangeLabel(data.from, data.to)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : !data || !data.kpis ? (
        <p className="text-muted-foreground">Erro ao carregar dados</p>
      ) : (
        <>
          {data.truncated && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2.5 text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle size={16} />
              Volume de dados excedeu o limite de consulta — os indicadores podem estar parciais.
            </div>
          )}

          {/* ── KPIs com comparativo ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <KpiCard
              icon={<Inbox size={16} />}
              label="Recebidos"
              value={data.kpis.total}
              color="blue"
              delta={<Delta current={data.kpis.total} previous={data.previous?.received ?? null} />}
            />
            <KpiCard
              icon={<CheckCircle2 size={16} />}
              label="Resolvidos"
              value={data.kpis.resolved}
              sublabel={data.kpis.resolution_rate !== null ? `taxa de resolução: ${data.kpis.resolution_rate}%` : undefined}
              color="green"
              delta={<Delta current={data.kpis.resolved} previous={data.previous?.resolved ?? null} />}
            />
            <KpiCard
              icon={<ShieldCheck size={16} />}
              label="SLA no prazo"
              value={data.kpis.sla_compliance !== null ? `${data.kpis.sla_compliance}%` : "—"}
              sublabel={`${data.ona.numerator}/${data.ona.denominator} resolvidos c/ SLA`}
              color={
                data.kpis.sla_compliance === null ? "blue"
                : data.kpis.sla_compliance >= 90 ? "green"
                : data.kpis.sla_compliance >= 70 ? "yellow"
                : "red"
              }
              delta={<Delta current={data.kpis.sla_compliance} previous={data.previous?.sla_compliance ?? null} mode="points" />}
            />
            <KpiCard
              icon={<Timer size={16} />}
              label="MTTA"
              value={formatMinutes(data.kpis.mtta)}
              sublabel="tempo médio 1ª resposta"
              color="purple"
              delta={<Delta current={data.kpis.mtta} previous={data.previous?.mtta ?? null} lowerIsBetter />}
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="MTTR"
              value={formatMinutes(data.kpis.mttr)}
              sublabel="tempo médio de resolução"
              color="purple"
              delta={<Delta current={data.kpis.mttr} previous={data.previous?.mttr ?? null} lowerIsBetter />}
            />
            <KpiCard
              icon={<Star size={16} />}
              label="CSAT"
              value={data.kpis.csat !== null ? `${data.kpis.csat}/5` : "—"}
              sublabel={`${data.kpis.rated_count} avaliações`}
              color={
                data.kpis.csat === null ? "blue"
                : data.kpis.csat >= 4 ? "green"
                : data.kpis.csat >= 3 ? "yellow"
                : "red"
              }
              delta={<Delta current={data.kpis.csat} previous={data.previous?.csat ?? null} />}
            />
            <KpiCard
              icon={<RotateCcw size={16} />}
              label="Reabertura"
              value={data.kpis.reopen_rate !== null ? `${data.kpis.reopen_rate}%` : "—"}
              sublabel={`${data.kpis.reopened_count} reaberto${data.kpis.reopened_count === 1 ? "" : "s"}`}
              color={
                data.kpis.reopen_rate === null ? "blue"
                : data.kpis.reopen_rate <= 5 ? "green"
                : data.kpis.reopen_rate <= 10 ? "yellow"
                : "red"
              }
              delta={<Delta current={data.kpis.reopen_rate} previous={data.previous?.reopen_rate ?? null} lowerIsBetter mode="points" />}
            />
          </div>

          {/* ── Indicador ONA ── */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ShieldCheck size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">Indicador ONA — Conformidade de Atendimento (SLA)</h2>
                <p className="text-xs text-muted-foreground">Resolvidos dentro do prazo ÷ Resolvidos no período com SLA definido × 100</p>
              </div>
              {data.ona.result !== null && (
                <span className={`text-lg font-bold px-4 py-1.5 rounded-full ${
                  data.ona.result >= 90 ? "bg-green-100 text-green-700"
                  : data.ona.result >= 70 ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  {data.ona.result}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Fórmula (lado esquerdo) */}
              <div className="border-l-4 border-blue-500 pl-5 space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-widest mb-2">Fórmula de Cálculo</p>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <p><span className="font-semibold text-gray-900">Numerador:</span> Chamados resolvidos no período dentro do prazo de SLA</p>
                    <p><span className="font-semibold text-gray-900">Denominador:</span> Chamados resolvidos no período que possuem prazo de SLA</p>
                    <p><span className="font-semibold text-gray-900">Cálculo:</span> (Numerador ÷ Denominador) × 100</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Objetivo</p>
                  <p className="text-sm text-gray-700">Respeitar a tolerância máxima estipulada para atendimentos no geral. A taxa de resolução (resolvidos ÷ recebidos) é acompanhada separadamente.</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Target size={14} className="text-blue-600" />
                  <span className="text-muted-foreground">Meta recomendada ONA:</span>
                  <span className="font-bold text-blue-700">≥ 90%</span>
                </div>
              </div>

              {/* Números (lado direito) */}
              <div className="space-y-5">
                {/* N / D = R */}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <div className="text-center min-w-20">
                    <p className="text-xs text-muted-foreground mb-1">Numerador</p>
                    <p className="text-4xl font-bold text-blue-700">{data.ona.numerator}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">resolvidos no prazo</p>
                  </div>
                  <span className="text-2xl text-gray-300 font-light">÷</span>
                  <div className="text-center min-w-20">
                    <p className="text-xs text-muted-foreground mb-1">Denominador</p>
                    <p className="text-4xl font-bold text-gray-700">{data.ona.denominator}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">resolvidos com SLA</p>
                  </div>
                  <span className="text-xl text-gray-300 font-light">×100 =</span>
                  <div className="text-center min-w-20">
                    <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                    <p className={`text-4xl font-bold ${
                      data.ona.result === null ? "text-gray-400"
                      : data.ona.result >= 90 ? "text-green-600"
                      : data.ona.result >= 70 ? "text-yellow-600"
                      : "text-red-600"
                    }`}>
                      {data.ona.result !== null ? `${data.ona.result}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">meta: ≥ 90%</p>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Desempenho atual</span>
                    <span className="font-medium">Meta: 90%</span>
                  </div>
                  <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        (data.ona.result ?? 0) >= 90 ? "bg-green-500"
                        : (data.ona.result ?? 0) >= 70 ? "bg-yellow-500"
                        : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(data.ona.result ?? 0, 100)}%` }}
                    />
                    {/* Linha da meta (90%) */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gray-700 opacity-60" style={{ left: "90%" }} />
                  </div>
                  <div className="flex justify-end mt-0.5">
                    <span className="text-[10px] text-gray-500" style={{ marginRight: "7%" }}>▲ meta</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tendência mensal do indicador ONA */}
            {data.monthly_ona && data.monthly_ona.length > 0 && (
              <div className="mt-6 pt-5 border-t">
                <p className="text-sm font-semibold text-gray-700 mb-1">Tendência Mensal — % de Conformidade</p>
                <p className="text-[11px] text-muted-foreground mb-4">Por mês de resolução: resolvidos no prazo ÷ resolvidos com SLA</p>
                <div className="space-y-2">
                  {data.monthly_ona.map((m) => (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 relative bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700 ${
                            m.pct === null ? "bg-gray-200"
                            : m.pct >= 90 ? "bg-green-500"
                            : m.pct >= 70 ? "bg-yellow-500"
                            : "bg-red-400"
                          }`}
                          style={{ width: m.pct !== null ? `${Math.max(m.pct, 2)}%` : "2%" }}
                        >
                          {(m.pct ?? 0) > 20 && (
                            <span className="text-[10px] text-white font-bold">{m.pct}%</span>
                          )}
                        </div>
                        {/* Linha de meta 90% */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-gray-500 opacity-50" style={{ left: "90%" }} />
                      </div>
                      <div className="text-right w-24 shrink-0">
                        {m.pct !== null ? (
                          <span className={`text-xs font-bold ${m.pct >= 90 ? "text-green-600" : m.pct >= 70 ? "text-yellow-600" : "text-red-500"}`}>
                            {m.pct}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem dados</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-1">({m.within}/{m.total})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── SLA dentro × fora + OLA ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={data.ola && data.ola.total > 0 ? "md:col-span-2" : "md:col-span-3"}>
              <SlaBreakdownCard sla={data.sla} />
            </div>
            {data.ola && data.ola.total > 0 && (
              <KpiCard
                icon={<Timer size={16} />}
                label="OLA (1ª resposta)"
                value={data.ola.pct !== null ? `${data.ola.pct}%` : "—"}
                sublabel={`${data.ola.within}/${data.ola.total} respondidos dentro do OLA da categoria`}
                color={
                  data.ola.pct === null ? "blue"
                  : data.ola.pct >= 90 ? "green"
                  : data.ola.pct >= 70 ? "yellow"
                  : "red"
                }
              />
            )}
          </div>

          {/* ── Aging do backlog + Por agente ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Aging */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CalendarClock size={16} className="text-gray-500" /> Aging do Backlog
                </h2>
                <span className="text-[11px] text-muted-foreground">situação atual (independe do período)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-4">Chamados abertos/em atendimento por tempo de vida</p>
              <BarChart
                items={data.aging.buckets.map((b, i) => ({
                  label: b.label,
                  count: b.count,
                  color: ["#22c55e", "#eab308", "#f97316", "#ef4444"][i] ?? "#ef4444",
                }))}
                maxCount={maxAging}
              />
              <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock size={14} /> Aguardando usuário (SLA pausado)
                </span>
                <span className="font-bold text-gray-900 bg-gray-100 rounded-full px-3 py-0.5">{data.aging.waiting_user}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock size={14} /> Aguardando terceiros (SLA pausado)
                </span>
                <span className="font-bold text-gray-900 bg-gray-100 rounded-full px-3 py-0.5">{data.aging.waiting_third_party ?? 0}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle size={14} className={data.kpis.critical_open > 0 ? "text-red-500" : ""} /> Críticos em aberto
                </span>
                <span className={`font-bold rounded-full px-3 py-0.5 ${data.kpis.critical_open > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-900"}`}>
                  {data.kpis.critical_open}
                </span>
              </div>
            </div>

            {/* Por agente */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Users size={16} className="text-gray-500" /> Por Agente
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                Atendidos = tickets atribuídos criados ou resolvidos no período · MTTR sobre os resolvidos
              </p>
              {data.by_agent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sem dados no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2 font-medium">Agente</th>
                        <th className="pb-2 font-medium text-right">Atendidos</th>
                        <th className="pb-2 font-medium text-right">Resolvidos</th>
                        <th className="pb-2 font-medium text-right">MTTR médio</th>
                        <th className="pb-2 font-medium text-right">CSAT médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_agent.map(a => (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 text-gray-800 truncate max-w-[160px]">{a.name}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{a.attended}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{a.resolved}</td>
                          <td className="py-2 text-right text-gray-700">{formatMinutes(a.mttr)}</td>
                          <td className="py-2 text-right">
                            {a.csat !== null ? (
                              <span className={`font-semibold ${a.csat >= 4 ? "text-green-600" : a.csat >= 3 ? "text-yellow-600" : "text-red-600"}`}>
                                {a.csat}/5
                                <span className="text-[10px] text-muted-foreground font-normal ml-1">({a.rated_count})</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── SLA estourado — motivos (omitido antes da migração 042) ── */}
          {data.breached_tickets !== null && (
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" /> SLA Estourado — Motivos
              </h2>
              <p className="text-[11px] text-muted-foreground mb-4">
                Chamados resolvidos no período após o prazo de SLA (até 100, mais recentes primeiro)
              </p>
              {data.breached_tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum SLA estourado no período 🎉</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2 font-medium">Nº</th>
                        <th className="pb-2 font-medium">Título</th>
                        <th className="pb-2 font-medium">Equipe</th>
                        <th className="pb-2 font-medium">Agente</th>
                        <th className="pb-2 font-medium">Resolvido em</th>
                        <th className="pb-2 font-medium">Prazo SLA</th>
                        <th className="pb-2 font-medium">Motivo do estouro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breached_tickets.map((t, i) => (
                        <tr key={`${t.number ?? "s"}-${i}`} className="border-b last:border-0 align-top">
                          <td className="py-2 text-gray-500 whitespace-nowrap">#{t.number ?? "—"}</td>
                          <td className="py-2 text-gray-800 max-w-[240px]"><span className="line-clamp-2">{t.title ?? "—"}</span></td>
                          <td className="py-2 text-gray-700 whitespace-nowrap">{t.team ? (TEAM_LABELS[t.team] ?? t.team) : "—"}</td>
                          <td className="py-2 text-gray-700 truncate max-w-[140px]">{t.assigned_name ?? "—"}</td>
                          <td className="py-2 text-gray-700 whitespace-nowrap">{formatDateTime(t.resolved_at)}</td>
                          <td className="py-2 text-gray-700 whitespace-nowrap">{formatDateTime(t.sla_deadline)}</td>
                          <td className="py-2 text-gray-700 max-w-[260px]">
                            {t.sla_breach_reason ? (
                              <span className="line-clamp-3">{t.sla_breach_reason}</span>
                            ) : (
                              <span
                                className="inline-block text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5"
                                title="Chamado resolvido antes da regra de registro de motivo"
                              >
                                sem motivo registrado
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Heatmap dia × hora ── */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <TicketCheck size={16} className="text-gray-500" /> Mapa de Calor — Abertura de Chamados (dia × hora)
            </h2>
            <p className="text-[11px] text-muted-foreground mb-4">Volume de chamados abertos no período por dia da semana e hora</p>
            <Heatmap matrix={data.heatmap} />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Volume mensal */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Volume Mensal (últimos 6 meses)</h2>
              <BarChart
                items={data.monthly_volume.map(m => ({
                  label: m.month,
                  count: m.count,
                  color: "#3b82f6",
                }))}
                maxCount={maxMonth}
              />
            </div>

            {/* Por prioridade */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Por Prioridade</h2>
              <BarChart
                items={data.by_priority.map(p => ({
                  label: p.label,
                  count: p.count,
                  color: p.color,
                }))}
                maxCount={maxPrio}
              />
            </div>

            {/* Por categoria */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Por Categoria</h2>
              <BarChart
                items={data.by_category.map(c => ({
                  label: c.name,
                  count: c.count,
                  color: c.color,
                }))}
                maxCount={maxCat}
              />
            </div>

            {/* Por setor */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Por Setor Solicitante (top 10)</h2>
              <BarChart
                items={data.by_sector.map(s => ({
                  label: s.name,
                  count: s.count,
                  color: "#8b5cf6",
                }))}
                maxCount={maxSector}
              />
            </div>
          </div>

          {/* Interpretação ONA */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-blue-800 mb-3">Referências ONA — Metas recomendadas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-blue-700">SLA no prazo</p>
                <p className="text-blue-600">Meta: ≥ 90%</p>
                <p className={`font-bold mt-1 ${
                  data.kpis.sla_compliance === null ? "text-gray-400"
                  : data.kpis.sla_compliance >= 90 ? "text-green-600"
                  : "text-red-600"
                }`}>
                  Atual: {data.kpis.sla_compliance !== null ? `${data.kpis.sla_compliance}%` : "Sem dados"}
                </p>
              </div>
              <div>
                <p className="font-medium text-blue-700">CSAT</p>
                <p className="text-blue-600">Meta: ≥ 4,0/5</p>
                <p className={`font-bold mt-1 ${
                  data.kpis.csat === null ? "text-gray-400"
                  : data.kpis.csat >= 4 ? "text-green-600"
                  : "text-red-600"
                }`}>
                  Atual: {data.kpis.csat !== null ? `${data.kpis.csat}/5` : "Sem dados"}
                </p>
              </div>
              <div>
                <p className="font-medium text-blue-700">Críticos em Aberto</p>
                <p className="text-blue-600">Meta: 0</p>
                <p className={`font-bold mt-1 ${data.kpis.critical_open === 0 ? "text-green-600" : "text-red-600"}`}>
                  Atual: {data.kpis.critical_open}
                </p>
              </div>
              <div>
                <p className="font-medium text-blue-700">Taxa de Reabertura</p>
                <p className="text-blue-600">Meta: ≤ 5%</p>
                <p className={`font-bold mt-1 ${
                  data.kpis.reopen_rate === null ? "text-gray-400"
                  : data.kpis.reopen_rate <= 5 ? "text-green-600"
                  : "text-red-600"
                }`}>
                  Atual: {data.kpis.reopen_rate !== null ? `${data.kpis.reopen_rate}%` : "Sem dados"}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
