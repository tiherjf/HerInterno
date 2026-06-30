"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TicketCheck, Clock, CheckCircle2, Star, AlertTriangle,
  TrendingUp, Download, RefreshCw, ShieldCheck, Target,
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
interface OnaData { numerator: number; denominator: number; result: number | null }
interface MonthOna { month: string; total: number; within: number; pct: number | null }

interface IndicatorsData {
  kpis: KPIs;
  ona: OnaData;
  by_category: CategoryBar[];
  by_priority: PriorityBar[];
  by_sector: SectorBar[];
  monthly_volume: MonthBar[];
  monthly_ona: MonthOna[];
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
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <p className="text-muted-foreground">Erro ao carregar dados</p>
      ) : (
        <>
          {/* ── Indicador ONA ── */}
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ShieldCheck size={20} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">Indicador ONA — Conformidade de Atendimento</h2>
                <p className="text-xs text-muted-foreground">Resoluções dentro do prazo / Total de chamados recebidos × 100</p>
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
                    <p><span className="font-semibold text-gray-900">Numerador:</span> Total de chamados solucionados dentro do prazo</p>
                    <p><span className="font-semibold text-gray-900">Denominador:</span> Total de chamados recebidos no período através do Sistema</p>
                    <p><span className="font-semibold text-gray-900">Cálculo:</span> (Numerador ÷ Denominador) × 100</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Objetivo</p>
                  <p className="text-sm text-gray-700">Respeitar a tolerância máxima estipulada para atendimentos no geral</p>
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">solucionados no prazo</p>
                  </div>
                  <span className="text-2xl text-gray-300 font-light">÷</span>
                  <div className="text-center min-w-20">
                    <p className="text-xs text-muted-foreground mb-1">Denominador</p>
                    <p className="text-4xl font-bold text-gray-700">{data.ona.denominator}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">total recebidos</p>
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
                <p className="text-sm font-semibold text-gray-700 mb-4">Tendência Mensal — % de Conformidade</p>
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
