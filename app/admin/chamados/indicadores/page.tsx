"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  TicketCheck, Clock, CheckCircle2, Star, AlertTriangle,
  TrendingUp, Download, RefreshCw
} from "lucide-react";

interface KPIs {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  critical_open: number;
  sla_compliance: number | null;
  avg_first_response: number | null;
  avg_resolution: number | null;
  csat: number | null;
  rated_count: number;
}

interface CategoryBar { name: string; color: string; count: number }
interface PriorityBar { label: string; key: string; count: number; color: string }
interface SectorBar { name: string; count: number }
interface MonthBar { month: string; count: number }

interface IndicatorsData {
  kpis: KPIs;
  by_category: CategoryBar[];
  by_priority: PriorityBar[];
  by_sector: SectorBar[];
  monthly_volume: MonthBar[];
}

const PERIODS = [
  { key: "month",    label: "Mês atual" },
  { key: "quarter",  label: "Trimestre" },
  { key: "semester", label: "Semestre" },
  { key: "year",     label: "Ano" },
];

function formatMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
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

function KpiCard({ icon, label, value, sublabel, color = "blue", alert = false }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
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
    <div className={`rounded-xl border p-5 ${alert ? "border-red-300 bg-red-50" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <div className={`text-3xl font-bold ${alert ? "text-red-700" : "text-gray-900"}`}>{value}</div>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

function exportCSV(data: IndicatorsData, period: string) {
  const rows = [
    ["Indicador", "Valor"],
    ["Total de chamados", data.kpis.total],
    ["Abertos", data.kpis.open],
    ["Em atendimento", data.kpis.in_progress],
    ["Resolvidos/Encerrados", data.kpis.resolved],
    ["Críticos em aberto", data.kpis.critical_open],
    ["SLA compliance (%)", data.kpis.sla_compliance ?? "N/A"],
    ["Tempo médio primeira resposta", formatMinutes(data.kpis.avg_first_response)],
    ["Tempo médio de resolução", formatMinutes(data.kpis.avg_resolution)],
    ["CSAT (1–5)", data.kpis.csat ?? "N/A"],
    ["Chamados avaliados", data.kpis.rated_count],
    [],
    ["Categoria", "Chamados"],
    ...data.by_category.map(c => [c.name, c.count]),
    [],
    ["Prioridade", "Chamados"],
    ...data.by_priority.map(p => [p.label, p.count]),
    [],
    ["Setor", "Chamados"],
    ...data.by_sector.map(s => [s.name, s.count]),
    [],
    ["Mês", "Volume"],
    ...data.monthly_volume.map(m => [m.month, m.count]),
  ];

  const bom = "﻿";
  const csv = bom + rows.map(r => r.map(String).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `indicadores_chamados_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IndicadoresPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<IndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chamados/indicadores?period=${period}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCat = data ? Math.max(...data.by_category.map(c => c.count), 1) : 1;
  const maxSector = data ? Math.max(...data.by_sector.map(s => s.count), 1) : 1;
  const maxPrio = data ? Math.max(...data.by_priority.map(p => p.count), 1) : 1;
  const maxMonth = data ? Math.max(...data.monthly_volume.map(m => m.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Indicadores de Chamados</h1>
          <p className="text-sm text-muted-foreground">Métricas para acompanhamento e acreditação ONA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          {data && (
            <Button variant="outline" size="sm" onClick={() => exportCSV(data, period)}>
              <Download size={16} /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Período */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key ? "bg-blue-600 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-muted-foreground">Erro ao carregar dados</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              icon={<TicketCheck size={18} />}
              label="Total de Chamados"
              value={data.kpis.total}
              color="blue"
            />
            <KpiCard
              icon={<Clock size={18} />}
              label="Abertos"
              value={data.kpis.open}
              sublabel={`${data.kpis.in_progress} em atendimento`}
              color="yellow"
            />
            <KpiCard
              icon={<AlertTriangle size={18} />}
              label="Críticos Abertos"
              value={data.kpis.critical_open}
              color="red"
              alert={data.kpis.critical_open > 0}
            />
            <KpiCard
              icon={<CheckCircle2 size={18} />}
              label="SLA Compliance"
              value={data.kpis.sla_compliance !== null ? `${data.kpis.sla_compliance}%` : "—"}
              sublabel="resolvidos no prazo"
              color={
                data.kpis.sla_compliance === null ? "blue"
                : data.kpis.sla_compliance >= 90 ? "green"
                : data.kpis.sla_compliance >= 70 ? "yellow"
                : "red"
              }
            />
            <KpiCard
              icon={<TrendingUp size={18} />}
              label="Tempo Médio Resolução"
              value={formatMinutes(data.kpis.avg_resolution)}
              sublabel={`1ª resposta: ${formatMinutes(data.kpis.avg_first_response)}`}
              color="purple"
            />
            <KpiCard
              icon={<Star size={18} />}
              label="CSAT"
              value={data.kpis.csat !== null ? `${data.kpis.csat}/5` : "—"}
              sublabel={`${data.kpis.rated_count} avaliações`}
              color={
                data.kpis.csat === null ? "blue"
                : data.kpis.csat >= 4 ? "green"
                : data.kpis.csat >= 3 ? "yellow"
                : "red"
              }
            />
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
                <p className="font-medium text-blue-700">SLA Compliance</p>
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
                <p className="font-medium text-blue-700">1ª Resposta (críticos)</p>
                <p className="text-blue-600">Meta: ≤ 1h</p>
                <p className="font-bold mt-1 text-gray-700">
                  Atual (geral): {formatMinutes(data.kpis.avg_first_response)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
