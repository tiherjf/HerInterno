import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const period = req.nextUrl.searchParams.get("period") ?? "month"; // month | quarter | semester | year
    const now = new Date();
    let from: Date;

    if (period === "quarter") {
      from = new Date(now); from.setMonth(now.getMonth() - 3);
    } else if (period === "semester") {
      from = new Date(now); from.setMonth(now.getMonth() - 6);
    } else if (period === "year") {
      from = new Date(now); from.setFullYear(now.getFullYear() - 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const supabase = createServiceClient();

    const { data: tickets } = await supabase
      .from("tickets")
      .select(`
        id, priority, status, created_at, first_response_at, resolved_at,
        sla_deadline, rating, requester_sector,
        ticket_categories(id, name, color)
      `)
      .gte("created_at", from.toISOString());

    const rows = tickets ?? [];

    // KPIs
    const total = rows.length;
    const open = rows.filter(t => t.status === "open").length;
    const inProgress = rows.filter(t => t.status === "in_progress").length;
    const resolved = rows.filter(t => ["resolved", "closed"].includes(t.status)).length;
    const critical_open = rows.filter(t => t.priority === "critical" && ["open", "in_progress"].includes(t.status)).length;

    // SLA compliance — tickets resolvidos dentro do prazo (base: resolvidos com SLA)
    const resolvedRows = rows.filter(t => t.resolved_at && t.sla_deadline);
    const slaOk = resolvedRows.filter(t => new Date(t.resolved_at!) <= new Date(t.sla_deadline!)).length;
    const sla_compliance = resolvedRows.length > 0 ? Math.round((slaOk / resolvedRows.length) * 100) : null;

    // ONA: numerador = solucionados no prazo / denominador = TOTAL recebidos no período
    const ona_numerator = slaOk;
    const ona_denominator = total;
    const ona_result = ona_denominator > 0 ? Math.round((ona_numerator / ona_denominator) * 100) : null;

    // Tempo médio de primeira resposta (minutos)
    const withFirstResponse = rows.filter(t => t.first_response_at);
    const avg_first_response = withFirstResponse.length > 0
      ? Math.round(
          withFirstResponse.reduce((acc, t) => {
            return acc + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime());
          }, 0) / withFirstResponse.length / 60000
        )
      : null;

    // Tempo médio de resolução (minutos)
    const withResolved = rows.filter(t => t.resolved_at);
    const avg_resolution = withResolved.length > 0
      ? Math.round(
          withResolved.reduce((acc, t) => {
            return acc + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
          }, 0) / withResolved.length / 60000
        )
      : null;

    // CSAT
    const rated = rows.filter(t => t.rating !== null && t.rating !== undefined);
    const csat = rated.length > 0
      ? Math.round((rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length) * 10) / 10
      : null;

    // Volume por categoria
    const byCat: Record<string, { name: string; color: string; count: number }> = {};
    rows.forEach(t => {
      const cat = (Array.isArray(t.ticket_categories) ? t.ticket_categories[0] : t.ticket_categories) as { id: string; name: string; color: string } | null;
      const key = cat?.id ?? "sem_categoria";
      if (!byCat[key]) byCat[key] = { name: cat?.name ?? "Sem categoria", color: cat?.color ?? "#6b7280", count: 0 };
      byCat[key].count++;
    });
    const by_category = Object.values(byCat).sort((a, b) => b.count - a.count);

    // Volume por prioridade
    const by_priority = [
      { label: "Crítica", key: "critical", count: rows.filter(t => t.priority === "critical").length, color: "#ef4444" },
      { label: "Alta",    key: "high",     count: rows.filter(t => t.priority === "high").length,     color: "#f97316" },
      { label: "Média",   key: "medium",   count: rows.filter(t => t.priority === "medium").length,   color: "#eab308" },
      { label: "Baixa",   key: "low",      count: rows.filter(t => t.priority === "low").length,      color: "#3b82f6" },
    ];

    // Volume por setor (top 10)
    const bySector: Record<string, number> = {};
    rows.forEach(t => {
      const s = t.requester_sector ?? "Não informado";
      bySector[s] = (bySector[s] ?? 0) + 1;
    });
    const by_sector = Object.entries(bySector)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Evolução mensal (últimos 6 meses)
    const monthly: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = 0;
    }
    rows.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthly) monthly[key]++;
    });
    const monthly_volume = Object.entries(monthly).map(([month, count]) => ({ month, count }));

    // Tendência ONA mensal (últimos 6 meses)
    // Por mês de criação: total recebidos vs solucionados no prazo naquele mês
    const onaMonthly: Record<string, { total: number; within: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      onaMonthly[key] = { total: 0, within: 0 };
    }
    rows.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!(key in onaMonthly)) return;
      onaMonthly[key].total++;
      if (t.resolved_at && t.sla_deadline && new Date(t.resolved_at) <= new Date(t.sla_deadline)) {
        onaMonthly[key].within++;
      }
    });
    const monthly_ona = Object.entries(onaMonthly).map(([month, v]) => ({
      month,
      total: v.total,
      within: v.within,
      pct: v.total > 0 ? Math.round((v.within / v.total) * 100) : null,
    }));

    return NextResponse.json({
      period,
      from: from.toISOString(),
      kpis: { total, open, in_progress: inProgress, resolved, critical_open, sla_compliance, avg_first_response, avg_resolution, csat, rated_count: rated.length },
      ona: { numerator: ona_numerator, denominator: ona_denominator, result: ona_result },
      by_category,
      by_priority,
      by_sector,
      monthly_volume,
      monthly_ona,
    });
  } catch (err) {
    return apiError(err);
  }
}
