"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart2, FileText, ClipboardList, Loader2, TrendingUp, Clock } from "lucide-react";
import type { Setor } from "./QualidadeView";

interface Props { sector: string | null; isAdmin: boolean; setores: Setor[] }

interface Stats {
  ncsAbertas: number; ncsTotal: number;
  indicadoresTotal: number; indicadoresRed: number;
  docsPublicados: number; docsExpiring: number;
  auditsAtivas: number;
}

interface RecentNC { id: string; number: string; title: string; severity: string; status: string; sector: string | null }

const SEV_COLOR: Record<string, string> = {
  critica: "bg-red-100 text-red-700",
  maior: "bg-orange-100 text-orange-700",
  menor: "bg-yellow-100 text-yellow-700",
  observacao: "bg-blue-100 text-blue-700",
};

export function PainelTab({ sector, isAdmin: _isAdmin, setores }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentNCs, setRecentNCs] = useState<RecentNC[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const sectorParam = sector ? `&sector=${encodeURIComponent(sector)}` : "";
        const [rNCs, rInds] = await Promise.all([
          fetch(`/api/qualidade/ncs?${sectorParam}`).then(r => r.json()),
          fetch(`/api/qualidade/indicadores?${sectorParam}`).then(r => r.json()),
        ]);

        const ncs: RecentNC[] = rNCs.ncs ?? [];
        const inds = rInds.indicators ?? [];
        const abertas = ncs.filter((n: RecentNC) => !["concluida","cancelada"].includes(n.status));

        let indRed = 0;
        for (const ind of inds) {
          const last = ind.records?.[ind.records.length - 1];
          if (last && ind.target_value !== null && last.actual_value < (ind.min_value ?? ind.target_value)) indRed++;
        }

        setStats({
          ncsAbertas: abertas.length,
          ncsTotal: ncs.length,
          indicadoresTotal: inds.length,
          indicadoresRed: indRed,
          docsPublicados: 0,
          docsExpiring: 0,
          auditsAtivas: 0,
        });
        setRecentNCs(ncs.slice(0, 8));
      } finally { setLoading(false); }
    }
    load();
  }, [sector]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const sectorLabel = sector ? `— ${sector}` : "— Todos os setores";

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Visão geral {sectorLabel}</p>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-red-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NCs abertas</span>
          </div>
          <p className={`text-3xl font-bold ${stats!.ncsAbertas > 0 ? "text-red-600" : "text-green-600"}`}>{stats!.ncsAbertas}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats!.ncsTotal} no total</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={15} className="text-blue-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Indicadores</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">{stats!.indicadoresTotal}</p>
          {stats!.indicadoresRed > 0 && <p className="text-xs text-red-600 mt-1 font-medium">{stats!.indicadoresRed} em estado crítico</p>}
          {stats!.indicadoresRed === 0 && stats!.indicadoresTotal > 0 && <p className="text-xs text-green-600 mt-1">Todos dentro da meta</p>}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-emerald-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Documentos</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">—</p>
          <p className="text-xs text-muted-foreground mt-1">Ver aba Documentos</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={15} className="text-purple-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Auditorias</span>
          </div>
          <p className="text-3xl font-bold text-gray-800">—</p>
          <p className="text-xs text-muted-foreground mt-1">Ver aba Auditorias</p>
        </div>
      </div>

      {/* Setores overview (only when "all") */}
      {!sector && setores.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-primary" /> Setores cadastrados</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {setores.map(s => (
              <div key={s.id} className="bg-white border rounded-xl p-3">
                <p className="font-semibold text-sm text-gray-800">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Clique no setor acima para filtrar</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent NCs */}
      {recentNCs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={15} className="text-primary" /> Não-conformidades recentes</h3>
          <div className="space-y-2">
            {recentNCs.map(nc => (
              <div key={nc.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground shrink-0">{nc.number}</span>
                <p className="flex-1 text-sm text-gray-800 truncate">{nc.title}</p>
                {nc.sector && <span className="text-xs text-muted-foreground shrink-0">{nc.sector}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_COLOR[nc.severity] ?? "bg-gray-100 text-gray-600"}`}>
                  {nc.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && stats!.ncsTotal === 0 && stats!.indicadoresTotal === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhum dado cadastrado{sector ? ` para o setor ${sector}` : ""}.</p>
          <p className="text-xs mt-1">Use as abas acima para começar a registrar NCs, indicadores e documentos.</p>
        </div>
      )}
    </div>
  );
}

function ShieldCheck({ size, className }: { size: number; className?: string }) {
  return <AlertTriangle size={size} className={className} />;
}
