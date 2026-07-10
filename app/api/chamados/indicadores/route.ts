import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

// Limite de linhas por consulta — evita carregar volumes gigantes em memória.
const ROW_LIMIT = 5000;

// Fuso do hospital (America/Sao_Paulo, UTC-3 fixo — sem horário de verão desde 2019).
const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;

interface TimedRow { created_at: string; resolved_at?: string | null; first_response_at?: string | null }
interface ResolvedRow { id: string; created_at: string; resolved_at: string | null; sla_deadline: string | null; rating: number | null; assigned_to: string | null }

// Média em minutos entre created_at e o campo final (first_response_at/resolved_at)
function avgMinutes(rows: TimedRow[], endField: "resolved_at" | "first_response_at"): number | null {
  const valid = rows.filter(r => r[endField]);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, r) => acc + (new Date(r[endField]!).getTime() - new Date(r.created_at).getTime()), 0);
  return Math.round(sum / valid.length / 60000);
}

// SLA: resolvidos dentro do prazo ÷ resolvidos que possuem sla_deadline
function slaStats(rows: { resolved_at: string | null; sla_deadline: string | null }[]) {
  const withSla = rows.filter(r => r.resolved_at && r.sla_deadline);
  const ok = withSla.filter(r => new Date(r.resolved_at!) <= new Date(r.sla_deadline!)).length;
  return {
    numerator: ok,
    denominator: withSla.length,
    pct: withSla.length > 0 ? Math.round((ok / withSla.length) * 100) : null,
  };
}

function csatOf(rows: { rating: number | null }[]) {
  const rated = rows.filter(r => r.rating !== null && r.rating !== undefined);
  return {
    csat: rated.length > 0
      ? Math.round((rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length) * 10) / 10
      : null,
    count: rated.length,
  };
}

// Busca em ticket_history quantos dos tickets informados foram reabertos (em lotes de 200)
async function countReopened(
  supabase: ReturnType<typeof createServiceClient>,
  ticketIds: string[],
): Promise<number> {
  const reopened = new Set<string>();
  for (let i = 0; i < ticketIds.length; i += 200) {
    const chunk = ticketIds.slice(i, i + 200);
    const { data } = await supabase
      .from("ticket_history")
      .select("ticket_id")
      .eq("action", "reopened")
      .in("ticket_id", chunk);
    (data ?? []).forEach((h: { ticket_id: string }) => reopened.add(h.ticket_id));
  }
  return reopened.size;
}

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

    // Janela anterior de mesma duração (para comparativo ▲▼)
    const windowMs = now.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - windowMs);

    const fromIso = from.toISOString();
    const prevFromIso = prevFrom.toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sixMonthsIso = sixMonthsAgo.toISOString();

    const supabase = createServiceClient();

    const [
      receivedRes,     // criados no período
      resolvedRes,     // resolvidos no período (independe de quando foram criados)
      respondedRes,    // primeira resposta no período (MTTA)
      backlogRes,      // em aberto agora (independe do período)
      sixMonthsRes,    // últimos 6 meses p/ evolução mensal
      prevReceivedRes, // janela anterior — apenas contagem
      prevResolvedRes, // janela anterior — resolvidos
      prevRespondedRes,// janela anterior — primeira resposta
    ] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, priority, status, created_at, requester_sector, ticket_categories(id, name, color)")
        .gte("created_at", fromIso)
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("id, created_at, resolved_at, sla_deadline, rating, assigned_to")
        .gte("resolved_at", fromIso)
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("created_at, first_response_at")
        .gte("first_response_at", fromIso)
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("id, status, priority, created_at")
        .in("status", ["open", "in_progress", "waiting_user"])
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("created_at, resolved_at, sla_deadline")
        .or(`created_at.gte.${sixMonthsIso},resolved_at.gte.${sixMonthsIso}`)
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", prevFromIso)
        .lt("created_at", fromIso),
      supabase
        .from("tickets")
        .select("id, created_at, resolved_at, sla_deadline, rating")
        .gte("resolved_at", prevFromIso)
        .lt("resolved_at", fromIso)
        .limit(ROW_LIMIT),
      supabase
        .from("tickets")
        .select("created_at, first_response_at")
        .gte("first_response_at", prevFromIso)
        .lt("first_response_at", fromIso)
        .limit(ROW_LIMIT),
    ]);

    const received = receivedRes.data ?? [];
    const resolvedRows = (resolvedRes.data ?? []) as ResolvedRow[];
    const responded = (respondedRes.data ?? []) as TimedRow[];
    const backlog = backlogRes.data ?? [];
    const sixMonthsRows = sixMonthsRes.data ?? [];
    const prevResolved = (prevResolvedRes.data ?? []) as Omit<ResolvedRow, "assigned_to">[];
    const prevResponded = (prevRespondedRes.data ?? []) as TimedRow[];

    const truncated =
      [received, resolvedRows, responded, backlog, sixMonthsRows, prevResolved, prevResponded]
        .some(arr => arr.length >= ROW_LIMIT);
    if (truncated) {
      console.warn(`[indicadores] consulta atingiu o limite de ${ROW_LIMIT} linhas — resultados truncados (period=${period})`);
    }

    // ── KPIs ──
    const total = received.length;
    const resolvedCount = resolvedRows.length;

    // Backlog atual (situação de agora, não do período)
    const openNow = backlog.filter(t => t.status === "open").length;
    const inProgressNow = backlog.filter(t => t.status === "in_progress").length;
    const waitingUserNow = backlog.filter(t => t.status === "waiting_user").length;
    const criticalOpen = backlog.filter(t => t.priority === "critical" && ["open", "in_progress"].includes(t.status)).length;

    // SLA compliance CORRIGIDO: resolvidos no prazo ÷ resolvidos no período com SLA definido
    const sla = slaStats(resolvedRows);

    // Taxa de resolução (informativa): resolvidos no período ÷ recebidos no período
    const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : null;

    // MTTA (primeira resposta no período) e MTTR (resolvidos no período) — minutos
    const mtta = avgMinutes(responded, "first_response_at");
    const mttr = avgMinutes(resolvedRows, "resolved_at");

    // CSAT — sobre os resolvidos no período
    const { csat, count: ratedCount } = csatOf(resolvedRows);

    // Taxa de reabertura — % dos resolvidos no período com ação "reopened" no histórico
    const reopenedCount = resolvedCount > 0
      ? await countReopened(supabase, resolvedRows.map(r => r.id))
      : 0;
    const reopenRate = resolvedCount > 0 ? Math.round((reopenedCount / resolvedCount) * 1000) / 10 : null;

    // ── Aging do backlog (open/in_progress; waiting_user à parte) ──
    const dayMs = 86400000;
    const agingBuckets = [
      { label: "0–3 dias", min: 0, max: 3, count: 0 },
      { label: "3–7 dias", min: 3, max: 7, count: 0 },
      { label: "7–15 dias", min: 7, max: 15, count: 0 },
      { label: "> 15 dias", min: 15, max: Infinity, count: 0 },
    ];
    backlog
      .filter(t => ["open", "in_progress"].includes(t.status))
      .forEach(t => {
        const ageDays = (now.getTime() - new Date(t.created_at).getTime()) / dayMs;
        const bucket = agingBuckets.find(b => ageDays >= b.min && ageDays < b.max);
        if (bucket) bucket.count++;
      });

    // ── Por agente (resolvidos no período) ──
    const byAgentMap: Record<string, { resolved: number; ratingSum: number; ratingCount: number }> = {};
    resolvedRows.forEach(t => {
      if (!t.assigned_to) return;
      if (!byAgentMap[t.assigned_to]) byAgentMap[t.assigned_to] = { resolved: 0, ratingSum: 0, ratingCount: 0 };
      byAgentMap[t.assigned_to].resolved++;
      if (t.rating !== null && t.rating !== undefined) {
        byAgentMap[t.assigned_to].ratingSum += t.rating;
        byAgentMap[t.assigned_to].ratingCount++;
      }
    });
    const agentIds = Object.keys(byAgentMap);
    let agentNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", agentIds);
      agentNames = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    }
    const by_agent = agentIds
      .map(id => ({
        id,
        name: agentNames[id] ?? "Desconhecido",
        resolved: byAgentMap[id].resolved,
        csat: byAgentMap[id].ratingCount > 0
          ? Math.round((byAgentMap[id].ratingSum / byAgentMap[id].ratingCount) * 10) / 10
          : null,
        rated_count: byAgentMap[id].ratingCount,
      }))
      .sort((a, b) => b.resolved - a.resolved);

    // ── Heatmap dia da semana × hora (criados no período, fuso do hospital) ──
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    received.forEach(t => {
      const local = new Date(new Date(t.created_at).getTime() + TZ_OFFSET_MS);
      heatmap[local.getUTCDay()][local.getUTCHours()]++;
    });

    // ── Volume por categoria ──
    const byCat: Record<string, { name: string; color: string; count: number }> = {};
    received.forEach(t => {
      const cat = (Array.isArray(t.ticket_categories) ? t.ticket_categories[0] : t.ticket_categories) as { id: string; name: string; color: string } | null;
      const key = cat?.id ?? "sem_categoria";
      if (!byCat[key]) byCat[key] = { name: cat?.name ?? "Sem categoria", color: cat?.color ?? "#6b7280", count: 0 };
      byCat[key].count++;
    });
    const by_category = Object.values(byCat).sort((a, b) => b.count - a.count);

    // ── Volume por prioridade ──
    const by_priority = [
      { label: "Crítica", key: "critical", count: received.filter(t => t.priority === "critical").length, color: "#ef4444" },
      { label: "Alta",    key: "high",     count: received.filter(t => t.priority === "high").length,     color: "#f97316" },
      { label: "Média",   key: "medium",   count: received.filter(t => t.priority === "medium").length,   color: "#eab308" },
      { label: "Baixa",   key: "low",      count: received.filter(t => t.priority === "low").length,      color: "#3b82f6" },
    ];

    // ── Volume por setor (top 10) ──
    const bySector: Record<string, number> = {};
    received.forEach(t => {
      const s = t.requester_sector ?? "Não informado";
      bySector[s] = (bySector[s] ?? 0) + 1;
    });
    const by_sector = Object.entries(bySector)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ── Evolução mensal (últimos 6 meses, independente do período) ──
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthly: Record<string, number> = {};
    const onaMonthly: Record<string, { total: number; within: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly[monthKey(d)] = 0;
      onaMonthly[monthKey(d)] = { total: 0, within: 0 };
    }
    sixMonthsRows.forEach(t => {
      const ck = monthKey(new Date(t.created_at));
      if (ck in monthly) monthly[ck]++;
      // Conformidade por mês de RESOLUÇÃO (coorte correta): resolvidos com SLA vs dentro do prazo
      if (t.resolved_at && t.sla_deadline) {
        const rk = monthKey(new Date(t.resolved_at));
        if (rk in onaMonthly) {
          onaMonthly[rk].total++;
          if (new Date(t.resolved_at) <= new Date(t.sla_deadline)) onaMonthly[rk].within++;
        }
      }
    });
    const monthly_volume = Object.entries(monthly).map(([month, count]) => ({ month, count }));
    const monthly_ona = Object.entries(onaMonthly).map(([month, v]) => ({
      month,
      total: v.total,
      within: v.within,
      pct: v.total > 0 ? Math.round((v.within / v.total) * 100) : null,
    }));

    // ── Comparativo com a janela anterior ──
    const prevSla = slaStats(prevResolved);
    const prevCsat = csatOf(prevResolved);
    const prevReopenedCount = prevResolved.length > 0
      ? await countReopened(supabase, prevResolved.map(r => r.id))
      : 0;
    const previous = {
      from: prevFromIso,
      to: fromIso,
      received: prevReceivedRes.count ?? 0,
      resolved: prevResolved.length,
      sla_compliance: prevSla.pct,
      mtta: avgMinutes(prevResponded, "first_response_at"),
      mttr: avgMinutes(prevResolved, "resolved_at"),
      csat: prevCsat.csat,
      reopen_rate: prevResolved.length > 0
        ? Math.round((prevReopenedCount / prevResolved.length) * 1000) / 10
        : null,
    };

    return NextResponse.json({
      period,
      from: fromIso,
      to: now.toISOString(),
      truncated,
      kpis: {
        total,
        open: openNow,
        in_progress: inProgressNow,
        waiting_user: waitingUserNow,
        resolved: resolvedCount,
        critical_open: criticalOpen,
        sla_compliance: sla.pct,
        resolution_rate: resolutionRate,
        mtta,
        mttr,
        // aliases retro-compatíveis
        avg_first_response: mtta,
        avg_resolution: mttr,
        csat,
        rated_count: ratedCount,
        reopen_rate: reopenRate,
        reopened_count: reopenedCount,
      },
      // ONA CORRIGIDO: resolvidos no prazo ÷ resolvidos no período com SLA definido
      ona: { numerator: sla.numerator, denominator: sla.denominator, result: sla.pct },
      aging: { buckets: agingBuckets.map(b => ({ label: b.label, count: b.count })), waiting_user: waitingUserNow },
      by_agent,
      heatmap,
      by_category,
      by_priority,
      by_sector,
      monthly_volume,
      monthly_ona,
      previous,
    });
  } catch (err) {
    return apiError(err);
  }
}
