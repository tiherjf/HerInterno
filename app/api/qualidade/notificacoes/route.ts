import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { sendEmail } from "@/lib/email/resend";
import { qualidadeAlertaEmail } from "@/lib/email/templates/qualidade-alerta";

// Executa a verificação e envio de alertas de qualidade.
// Chamado manualmente (POST, staff autorizado) ou pelo cron do Vercel (GET com CRON_SECRET).
async function runQualityAlertsJob() {
    const svc = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const ago7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // As 4 verificações são independentes → em paralelo
    const [{ data: overdue }, { data: noPlans }, { data: expiringDocs }, { data: indicators }] = await Promise.all([
      // 1. NCs com prazo vencido (abertas)
      svc
        .from("quality_ncs")
        .select("id, number, title, deadline, responsible_id, responsible:responsible_id(id)")
        .not("status", "in", '("concluida","cancelada")')
        .lt("deadline", today)
        .not("deadline", "is", null),
      // 2. NCs abertas há mais de 7 dias (o filtro "sem plano de ação" vem abaixo)
      svc
        .from("quality_ncs")
        .select("id, number, title, created_at, responsible_id")
        .in("status", ["aberta", "em_analise"])
        .lt("created_at", ago7days),
      // 3. Documentos vencendo nos próximos 30 dias
      svc
        .from("quality_documents")
        .select("id, code, title, valid_until, created_by")
        .gte("valid_until", today)
        .lte("valid_until", in30days)
        .eq("status", "publicado"),
      // 4. Indicadores com mínimo definido + APENAS o registro mais recente de cada um
      //    (antes vinham todos, sem ordem, e o "último" do array era um mês qualquer)
      svc
        .from("quality_indicators")
        .select("id, name, unit, min_value, responsible_id, quality_indicator_records(actual_value, reference_month)")
        .eq("active", true)
        .not("min_value", "is", null)
        .order("reference_month", { referencedTable: "quality_indicator_records", ascending: false })
        .limit(1, { referencedTable: "quality_indicator_records" }),
    ]);

    // NCs sem plano de ação: uma consulta para todas (antes era uma por NC)
    let noPlansFiltered: NonNullable<typeof noPlans> = [];
    if (noPlans && noPlans.length > 0) {
      const { data: plans } = await svc
        .from("quality_action_plans")
        .select("nc_id")
        .in("nc_id", noPlans.map(nc => nc.id));
      const withPlan = new Set((plans ?? []).map((p: { nc_id: string }) => p.nc_id));
      noPlansFiltered = noPlans.filter(nc => !withPlan.has(nc.id));
    }

    // Indicador crítico: registro mais recente abaixo do mínimo aceitável
    const criticalInds = (indicators ?? []).filter(ind => {
      const latest = (ind.quality_indicator_records as { actual_value: number }[] | null)?.[0];
      return !!latest && latest.actual_value < (ind.min_value as number);
    });

    // Collect all responsible user IDs
    const userIds = new Set<string>();
    overdue?.forEach(n => { if (n.responsible_id) userIds.add(n.responsible_id); });
    noPlansFiltered?.forEach(n => { if (n.responsible_id) userIds.add(n.responsible_id); });
    expiringDocs?.forEach(d => { if (d.created_by) userIds.add(d.created_by); });
    criticalInds?.forEach(i => { if (i.responsible_id) userIds.add(i.responsible_id as string); });

    // Group alerts by responsible user
    type AlertEntry = { number?: string; title: string; detail: string; urgency: "alta" | "media" | "baixa" };
    const alertsByUser = new Map<string, AlertEntry[]>();

    const pushAlert = (uid: string | null, alert: AlertEntry) => {
      if (!uid) return;
      if (!alertsByUser.has(uid)) alertsByUser.set(uid, []);
      alertsByUser.get(uid)!.push(alert);
    };

    overdue?.forEach(n => pushAlert(n.responsible_id, {
      number: n.number, title: n.title,
      detail: `Prazo vencido em ${n.deadline}`, urgency: "alta",
    }));
    noPlansFiltered?.forEach(n => pushAlert(n.responsible_id, {
      number: n.number, title: n.title,
      detail: "Aberta há mais de 7 dias sem plano de ação", urgency: "alta",
    }));
    expiringDocs?.forEach(d => pushAlert(d.created_by, {
      title: d.title,
      detail: `Documento vence em ${d.valid_until}`, urgency: "media",
    }));
    criticalInds?.forEach(i => pushAlert(i.responsible_id as string | null, {
      title: i.name,
      detail: "Indicador abaixo do mínimo aceitável", urgency: "alta",
    }));

    // Destinatários: nomes numa consulta só e e-mails em paralelo (antes eram
    // 2 idas ao banco em sequência por pessoa, intercaladas com os envios)
    const uids = Array.from(alertsByUser.keys());
    const [{ data: profs }, emails] = await Promise.all([
      uids.length > 0
        ? svc.from("profiles").select("id, full_name").in("id", uids)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      Promise.all(uids.map(uid =>
        svc.auth.admin.getUserById(uid)
          .then(({ data }) => data?.user?.email ?? null)
          .catch(() => null)
      )),
    ]);
    const nameById = new Map((profs ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

    // Envios seguem um por vez: o Resend limita a ~2 req/s
    let sent = 0;
    for (let i = 0; i < uids.length; i++) {
      const email = emails[i];
      if (!email) continue;
      try {
        const { subject, html } = qualidadeAlertaEmail({
          recipientName: nameById.get(uids[i]) ?? "Colaborador",
          alerts: alertsByUser.get(uids[i])!,
        });
        await sendEmail({ to: email, subject, html });
        sent++;
      } catch { /* skip individual failures */ }
    }

    return {
      overdueNCs: overdue?.length ?? 0,
      noPlansNCs: noPlansFiltered.length,
      expiringDocs: expiringDocs?.length ?? 0,
      criticalIndicators: criticalInds?.length ?? 0,
      emailsSent: sent,
    };
}

// POST — disparo manual pelo painel (staff autorizado)
export async function POST() {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const summary = await runQualityAlertsJob();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    // Cron do Vercel: GET com Authorization: Bearer <CRON_SECRET> executa o job
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`
    ) {
      const summary = await runQualityAlertsJob();
      return NextResponse.json({ ok: true, cron: true, summary });
    }

    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [{ count: overdueNCs }, { count: expiringDocs }] = await Promise.all([
      svc.from("quality_ncs")
        .select("*", { count: "exact", head: true })
        .not("status", "in", '("concluida","cancelada")')
        .lt("deadline", today)
        .not("deadline", "is", null),
      svc.from("quality_documents")
        .select("*", { count: "exact", head: true })
        .gte("valid_until", today)
        .lte("valid_until", in30days)
        .eq("status", "publicado"),
    ]);

    return NextResponse.json({ overdueNCs: overdueNCs ?? 0, expiringDocs: expiringDocs ?? 0 });
  } catch (err) {
    return apiError(err);
  }
}
