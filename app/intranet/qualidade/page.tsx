import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AlertTriangle, BarChart2, FileText, ClipboardList, ShieldCheck, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

export const revalidate = 60;

async function getStats() {
  const svc = createServiceClient();
  const [
    { count: ncsAbertas },
    { count: ncsTotal },
    { data: indicadoresRed },
    { count: docsExpiring },
    { count: auditsAtivas },
  ] = await Promise.all([
    svc.from("quality_ncs").select("*", { count: "exact", head: true })
      .in("status", ["aberta", "em_analise", "plano_definido", "em_execucao", "verificacao"]),
    svc.from("quality_ncs").select("*", { count: "exact", head: true }),
    svc.from("quality_indicators").select("id, min_value, quality_indicator_records(actual_value, reference_month)")
      .eq("active", true),
    svc.from("quality_documents").select("*", { count: "exact", head: true })
      .lte("valid_until", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .gte("valid_until", new Date().toISOString().split("T")[0])
      .eq("status", "publicado"),
    svc.from("quality_audits").select("*", { count: "exact", head: true })
      .in("status", ["agendada", "em_andamento"]),
  ]);

  return {
    ncsAbertas: ncsAbertas ?? 0,
    ncsTotal: ncsTotal ?? 0,
    docsExpiring: docsExpiring ?? 0,
    auditsAtivas: auditsAtivas ?? 0,
    indicadoresRed: 0,
  };
}

export default async function QualidadePage() {
  await requireStaff();
  const stats = await getStats();

  const modules = [
    {
      href: "/intranet/qualidade/nao-conformidades",
      icon: AlertTriangle,
      label: "Não-Conformidades",
      description: "Registre, analise e acompanhe NCs com plano de ação 5W2H",
      accent: "bg-red-50 border-red-100",
      iconColor: "text-red-500",
      stat: stats.ncsAbertas > 0 ? `${stats.ncsAbertas} abertas` : "Nenhuma aberta",
      statColor: stats.ncsAbertas > 0 ? "text-red-600" : "text-green-600",
    },
    {
      href: "/intranet/qualidade/indicadores",
      icon: BarChart2,
      label: "Indicadores",
      description: "Monitore KPIs com metas, semáforo e histórico de evolução",
      accent: "bg-blue-50 border-blue-100",
      iconColor: "text-blue-500",
      stat: "Acompanhamento contínuo",
      statColor: "text-blue-600",
    },
    {
      href: "/intranet/qualidade/documentos",
      icon: FileText,
      label: "Documentos",
      description: "POPs, protocolos, políticas e manuais com controle de versão",
      accent: "bg-emerald-50 border-emerald-100",
      iconColor: "text-emerald-500",
      stat: stats.docsExpiring > 0 ? `${stats.docsExpiring} vencem em 30 dias` : "Documentos em dia",
      statColor: stats.docsExpiring > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      href: "/intranet/qualidade/auditorias",
      icon: ClipboardList,
      label: "Auditorias",
      description: "Agende auditorias, registre achados e vincule a planos de ação",
      accent: "bg-purple-50 border-purple-100",
      iconColor: "text-purple-500",
      stat: stats.auditsAtivas > 0 ? `${stats.auditsAtivas} em andamento` : "Nenhuma agendada",
      statColor: stats.auditsAtivas > 0 ? "text-purple-600" : "text-gray-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="brand-gradient rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck size={24} className="opacity-80" />
          <h2 className="text-2xl font-bold">Gestão da Qualidade</h2>
        </div>
        <p className="text-white/70 text-sm">
          Ciclo PDCA — Planejar, Fazer, Checar e Agir para melhoria contínua.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">NCs Abertas</span>
          </div>
          <p className={`text-2xl font-bold ${stats.ncsAbertas > 0 ? "text-red-600" : "text-green-600"}`}>{stats.ncsAbertas}</p>
          <p className="text-xs text-muted-foreground">{stats.ncsTotal} no total</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Indicadores</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">—</p>
          <p className="text-xs text-muted-foreground">Ver painel completo</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Docs. vencendo</span>
          </div>
          <p className={`text-2xl font-bold ${stats.docsExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.docsExpiring}</p>
          <p className="text-xs text-muted-foreground">nos próximos 30 dias</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-purple-400" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Auditorias</span>
          </div>
          <p className={`text-2xl font-bold ${stats.auditsAtivas > 0 ? "text-purple-600" : "text-gray-400"}`}>{stats.auditsAtivas}</p>
          <p className="text-xs text-muted-foreground">em andamento</p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modules.map(m => (
          <Link key={m.href} href={m.href}
            className={`group rounded-xl border p-6 flex gap-4 hover:shadow-md transition-all ${m.accent}`}>
            <div className={`shrink-0 w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm ${m.iconColor}`}>
              <m.icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{m.label}</h3>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">{m.description}</p>
              <p className={`text-xs font-semibold mt-2 ${m.statColor}`}>{m.stat}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
