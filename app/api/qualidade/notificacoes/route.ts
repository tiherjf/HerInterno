import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { sendEmail } from "@/lib/email/resend";
import { qualidadeAlertaEmail } from "@/lib/email/templates/qualidade-alerta";

// POST /api/qualidade/notificacoes — verifica e envia alertas. Admin/ti/rh only.
export async function POST() {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const ago7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. NCs com prazo vencido (abertas)
    const { data: overdue } = await svc
      .from("quality_ncs")
      .select("id, number, title, deadline, responsible_id, responsible:responsible_id(id)")
      .not("status", "in", '("concluida","cancelada")')
      .lt("deadline", today)
      .not("deadline", "is", null);

    // 2. NCs abertas há mais de 7 dias sem nenhum plano de ação
    const { data: noPlans } = await svc
      .from("quality_ncs")
      .select("id, number, title, created_at, responsible_id")
      .in("status", ["aberta", "em_analise"])
      .lt("created_at", ago7days);

    const noPlansFiltered: typeof noPlans = [];
    if (noPlans) {
      for (const nc of noPlans) {
        const { count } = await svc
          .from("quality_action_plans")
          .select("*", { count: "exact", head: true })
          .eq("nc_id", nc.id);
        if ((count ?? 0) === 0) noPlansFiltered.push(nc);
      }
    }

    // 3. Documentos vencendo nos próximos 30 dias
    const { data: expiringDocs } = await svc
      .from("quality_documents")
      .select("id, code, title, valid_until, created_by")
      .gte("valid_until", today)
      .lte("valid_until", in30days)
      .eq("status", "publicado");

    // 4. Indicadores em estado crítico (abaixo do mínimo)
    const { data: indicators } = await svc
      .from("quality_indicators")
      .select("id, name, unit, min_value, responsible_id, quality_indicator_records(actual_value, reference_month)")
      .eq("active", true)
      .not("min_value", "is", null);

    const criticalInds: typeof indicators = [];
    if (indicators) {
      for (const ind of indicators) {
        const recs = (ind.quality_indicator_records as { actual_value: number }[] | null) ?? [];
        if (recs.length === 0) continue;
        const last = recs[recs.length - 1];
        if (last.actual_value < (ind.min_value as number)) criticalInds.push(ind);
      }
    }

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

    // Send emails
    let sent = 0;
    for (const [uid, alerts] of Array.from(alertsByUser.entries())) {
      try {
        const { data: authUser } = await svc.auth.admin.getUserById(uid);
        const email = authUser?.user?.email;
        const { data: prof } = await svc.from("profiles").select("full_name").eq("id", uid).single();
        if (!email) continue;
        const { subject, html } = qualidadeAlertaEmail({
          recipientName: (prof?.full_name as string | null) ?? "Colaborador",
          alerts,
        });
        await sendEmail({ to: email, subject, html });
        sent++;
      } catch { /* skip individual failures */ }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        overdueNCs: overdue?.length ?? 0,
        noPlansNCs: noPlansFiltered.length,
        expiringDocs: expiringDocs?.length ?? 0,
        criticalIndicators: criticalInds?.length ?? 0,
        emailsSent: sent,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET() {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
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
