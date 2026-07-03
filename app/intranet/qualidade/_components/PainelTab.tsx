"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart2, FileText, Clock, Loader2, TrendingUp, Bell, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface RecentNC { id: string; number: string; title: string; severity: string; status: string; sector: string | null }
interface Indicator { id: string; name: string; unit: string; target_value: number | null; min_value: number | null; sector: string | null; records: { actual_value: number }[] }

const SEV_COLOR: Record<string, string> = {
  critica: "bg-red-100 text-red-700", maior: "bg-orange-100 text-orange-700",
  menor: "bg-yellow-100 text-yellow-700", observacao: "bg-blue-100 text-blue-700",
};

function healthScore(ncsAbertas: number, ncsTotal: number, indRed: number, indTotal: number): number {
  if (ncsTotal === 0 && indTotal === 0) return 100;
  let score = 100;
  if (ncsTotal > 0) score -= Math.min(40, (ncsAbertas / Math.max(ncsTotal, 1)) * 40);
  if (indTotal > 0) score -= Math.min(30, (indRed / Math.max(indTotal, 1)) * 30);
  return Math.round(score);
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-500";
  const textColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{score}%</span>
    </div>
  );
}

export function PainelTab({ sector, isAdmin, setores }: Props) {
  const [ncs, setNcs] = useState<RecentNC[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [alertCounts, setAlertCounts] = useState<{ overdueNCs: number; expiringDocs: number } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const sectorParam = sector ? `sector=${encodeURIComponent(sector)}` : "";
        const [rNCs, rInds] = await Promise.all([
          fetch(`/api/qualidade/ncs?${sectorParam}`).then(r => r.json()),
          fetch(`/api/qualidade/indicadores?${sectorParam}`).then(r => r.json()),
        ]);
        setNcs(rNCs.ncs ?? []);
        setIndicators(rInds.indicators ?? []);
        if (isAdmin) {
          const rAlerts = await fetch("/api/qualidade/notificacoes");
          const dAlerts = await rAlerts.json();
          setAlertCounts(dAlerts);
        }
      } finally { setLoading(false); }
    }
    load();
  }, [sector, isAdmin]);

  async function sendNotificacoes() {
    setSending(true); setSendResult(null);
    const r = await fetch("/api/qualidade/notificacoes", { method: "POST" });
    const d = await r.json();
    if (d.ok) setSendResult(`✅ ${d.summary.emailsSent} e-mail(s) enviado(s). NCs vencidas: ${d.summary.overdueNCs} · Docs vencendo: ${d.summary.expiringDocs}`);
    else setSendResult("❌ Erro ao enviar notificações.");
    setSending(false);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const abertas = ncs.filter(n => !["concluida","cancelada"].includes(n.status));
  const indRed = indicators.filter(ind => {
    const last = ind.records?.[ind.records.length - 1];
    return last && ind.min_value !== null && last.actual_value < ind.min_value;
  });

  // Per-sector breakdown when showing all
  const sectorStats = !sector ? setores.map(s => {
    const sNCs = ncs.filter(n => n.sector === s.name);
    const sAbertas = sNCs.filter(n => !["concluida","cancelada"].includes(n.status));
    const sInds = indicators.filter(i => i.sector === s.name);
    const sRed = sInds.filter(ind => {
      const last = ind.records?.[ind.records.length - 1];
      return last && ind.min_value !== null && last.actual_value < ind.min_value;
    });
    const score = healthScore(sAbertas.length, sNCs.length, sRed.length, sInds.length);
    return { setor: s, ncsAbertas: sAbertas.length, ncsTotal: sNCs.length, indTotal: sInds.length, indRed: sRed.length, score };
  }) : null;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Visão geral {sector ? `— ${sector}` : "— Todos os setores"}</p>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={15} className="text-red-400" /><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NCs abertas</span></div>
          <p className={`text-3xl font-bold ${abertas.length > 0 ? "text-red-600" : "text-green-600"}`}>{abertas.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{ncs.length} no total</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart2 size={15} className="text-blue-400" /><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Indicadores</span></div>
          <p className="text-3xl font-bold text-gray-800">{indicators.length}</p>
          {indRed.length > 0 && <p className="text-xs text-red-600 mt-1 font-medium">{indRed.length} crítico{indRed.length !== 1 ? "s" : ""}</p>}
          {indRed.length === 0 && indicators.length > 0 && <p className="text-xs text-green-600 mt-1">Todos na meta</p>}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><FileText size={15} className="text-emerald-400" /><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Documentos</span></div>
          {alertCounts !== null ? (
            <>
              <p className={`text-3xl font-bold ${alertCounts.expiringDocs > 0 ? "text-amber-600" : "text-green-600"}`}>{alertCounts.expiringDocs}</p>
              <p className="text-xs text-muted-foreground mt-1">vencendo em 30 dias</p>
            </>
          ) : <p className="text-3xl font-bold text-gray-400">—</p>}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2"><Clock size={15} className="text-orange-400" /><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NCs vencidas</span></div>
          {alertCounts !== null ? (
            <>
              <p className={`text-3xl font-bold ${alertCounts.overdueNCs > 0 ? "text-red-600" : "text-green-600"}`}>{alertCounts.overdueNCs}</p>
              <p className="text-xs text-muted-foreground mt-1">prazo expirado</p>
            </>
          ) : <p className="text-3xl font-bold text-gray-400">—</p>}
        </div>
      </div>

      {/* Score geral (when filtered by sector) */}
      {sector && (
        <div className="bg-white border rounded-xl p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Score de conformidade — {sector}</p>
          <div className="flex items-center gap-4">
            <div>
              {(() => {
                const score = healthScore(abertas.length, ncs.length, indRed.length, indicators.length);
                const label = score >= 80 ? "Adequado" : score >= 60 ? "Atenção" : "Crítico";
                const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
                return <p className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg">%</span></p>;
              })()}
              <p className="text-xs text-muted-foreground">baseado em NCs e indicadores</p>
            </div>
            <div className="flex-1">
              <HealthBar score={healthScore(abertas.length, ncs.length, indRed.length, indicators.length)} />
            </div>
          </div>
        </div>
      )}

      {/* Sector health grid */}
      {sectorStats && sectorStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-primary" /> Score por setor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectorStats.map(({ setor, ncsAbertas, ncsTotal, indTotal, indRed: sRed, score }) => (
              <div key={setor.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm text-gray-800">{setor.name}</p>
                  <span className={`text-xs font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600"}`}>{score}%</span>
                </div>
                <HealthBar score={score} />
                <div className="grid grid-cols-2 gap-1 mt-3 text-xs text-muted-foreground">
                  <span>{ncsAbertas} NC{ncsAbertas !== 1 ? "s" : ""} aberta{ncsAbertas !== 1 ? "s" : ""}</span>
                  <span>{indTotal} indicador{indTotal !== 1 ? "es" : ""}</span>
                  {ncsTotal > 0 && <span className="text-gray-400">{ncsTotal} total de NCs</span>}
                  {sRed > 0 && <span className="text-red-500 font-medium">{sRed} indicador{sRed !== 1 ? "es" : ""} crítico{sRed !== 1 ? "s" : ""}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent NCs */}
      {ncs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={15} className="text-primary" /> NCs recentes</h3>
          <div className="space-y-2">
            {ncs.slice(0, 6).map(nc => (
              <div key={nc.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground shrink-0">{nc.number}</span>
                <p className="flex-1 text-sm text-gray-800 truncate">{nc.title}</p>
                {nc.sector && <span className="text-xs text-muted-foreground shrink-0">{nc.sector}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_COLOR[nc.severity] ?? "bg-gray-100 text-gray-600"}`}>{nc.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification sender */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><Bell size={14} /> Enviar alertas por e-mail</p>
              <p className="text-xs text-amber-600 mt-0.5">Notifica responsáveis sobre NCs vencidas, sem plano, documentos expirando e indicadores críticos.</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-100"
              onClick={sendNotificacoes} disabled={sending}>
              {sending ? <Loader size={13} className="animate-spin" /> : "Enviar agora"}
            </Button>
          </div>
          {sendResult && <p className="text-xs text-amber-700 mt-3 font-medium">{sendResult}</p>}
        </div>
      )}

      {ncs.length === 0 && indicators.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum dado{sector ? ` para ${sector}` : ""}. Comece registrando NCs e indicadores.</p>
        </div>
      )}
    </div>
  );
}
