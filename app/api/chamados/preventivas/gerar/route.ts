import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { computeSlaDeadline } from "@/lib/chamados/sla";
import {
  isMissingPlansTable,
  todayISO,
  addDaysISO,
  PLAN_MANAGER_ROLES,
} from "@/lib/chamados/preventivas";

const AUTO_LINE = "Ordem gerada automaticamente pelo plano de manutenção preventiva.";

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  equipment_patrimonio: string | null;
  category_id: string | null;
  frequency_days: number;
  next_due: string;
  created_by: string | null;
}

interface RequesterInfo {
  id: string;
  full_name: string;
  sector: string | null;
}

/**
 * Gera os chamados dos planos preventivos vencidos (next_due <= hoje) e avança
 * a próxima execução. Pula planos que já têm chamado aberto/em andamento.
 */
async function runGeracao() {
  const svc = createServiceClient();
  const hoje = todayISO();

  const { data: plans, error } = await svc
    .from("maintenance_plans")
    .select("id, title, description, location, equipment_patrimonio, category_id, frequency_days, next_due, created_by")
    .eq("active", true)
    .lte("next_due", hoje)
    .order("next_due", { ascending: true });

  if (error) {
    if (isMissingPlansTable(error)) {
      return { pending_migration: true, generated: 0, skipped: 0, plans: 0 };
    }
    throw error;
  }

  const duePlans = (plans ?? []) as PlanRow[];
  if (duePlans.length === 0) {
    return { generated: 0, skipped: 0, plans: 0, details: [] };
  }

  // Categorias (sla_hours) dos planos vencidos, em uma única consulta
  const categoryIds = Array.from(
    new Set(duePlans.map((p) => p.category_id).filter(Boolean))
  ) as string[];
  const slaByCategory = new Map<string, number | null>();
  if (categoryIds.length > 0) {
    const { data: cats } = await svc
      .from("ticket_categories")
      .select("id, sla_hours")
      .in("id", categoryIds);
    for (const c of cats ?? []) slaByCategory.set(c.id, c.sla_hours ?? null);
  }

  // Perfis dos criadores dos planos (solicitante do chamado gerado)
  const creatorIds = Array.from(
    new Set(duePlans.map((p) => p.created_by).filter(Boolean))
  ) as string[];
  const profilesById = new Map<string, RequesterInfo>();
  if (creatorIds.length > 0) {
    const { data: profs } = await svc
      .from("profiles")
      .select("id, full_name, sector")
      .in("id", creatorIds);
    for (const p of profs ?? []) profilesById.set(p.id, p as RequesterInfo);
  }

  // Fallback: qualquer admin ativo como solicitante
  let fallbackRequester: RequesterInfo | null = null;
  const { data: adminProfile } = await svc
    .from("profiles")
    .select("id, full_name, sector")
    .eq("role", "admin")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (adminProfile) fallbackRequester = adminProfile as RequesterInfo;

  let generated = 0;
  let skipped = 0;
  const details: Array<{ plan_id: string; title: string; status: string; ticket_number?: number }> = [];

  for (const plan of duePlans) {
    // Evita duplicidade: já existe chamado aberto/em andamento deste plano?
    const { data: existing, error: existErr } = await svc
      .from("tickets")
      .select("id")
      .eq("plan_id", plan.id)
      .in("status", ["open", "in_progress"])
      .limit(1)
      .maybeSingle();
    if (existErr) throw existErr;

    if (existing) {
      skipped += 1;
      details.push({ plan_id: plan.id, title: plan.title, status: "skipped_duplicate" });
      console.log(`[Preventivas] Plano "${plan.title}" (${plan.id}) pulado: chamado em aberto.`);
    } else {
      const requester =
        (plan.created_by ? profilesById.get(plan.created_by) : null) ?? fallbackRequester;
      if (!requester) {
        skipped += 1;
        details.push({ plan_id: plan.id, title: plan.title, status: "skipped_no_requester" });
        console.log(`[Preventivas] Plano "${plan.title}" (${plan.id}) pulado: sem solicitante disponível.`);
        continue;
      }

      let sla_deadline: string | null = null;
      const slaHours = plan.category_id ? slaByCategory.get(plan.category_id) : null;
      if (slaHours) {
        const deadline = await computeSlaDeadline(svc, new Date(), slaHours);
        sla_deadline = deadline.toISOString();
      }

      const description = plan.description?.trim()
        ? `${plan.description.trim()}\n\n${AUTO_LINE}`
        : AUTO_LINE;

      const { data: ticket, error: insertErr } = await svc
        .from("tickets")
        .insert({
          title: `[Preventiva] ${plan.title}`,
          description,
          team: "manutencao",
          priority: "medium",
          status: "open",
          category_id: plan.category_id,
          plan_id: plan.id,
          requester_id: requester.id,
          requester_name: requester.full_name,
          requester_sector: requester.sector || null,
          location: plan.location,
          equipment_patrimonio: plan.equipment_patrimonio,
          sla_deadline,
        })
        .select("id, number")
        .single();
      if (insertErr) throw insertErr;

      generated += 1;
      details.push({
        plan_id: plan.id,
        title: plan.title,
        status: "generated",
        ticket_number: ticket?.number,
      });
    }

    // Avança next_due até ultrapassar hoje (recupera execuções perdidas)
    let nextDue = plan.next_due;
    while (nextDue <= hoje) {
      nextDue = addDaysISO(nextDue, plan.frequency_days);
    }
    const { error: updErr } = await svc
      .from("maintenance_plans")
      .update({ next_due: nextDue, last_generated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (updErr) throw updErr;
  }

  return { generated, skipped, plans: duePlans.length, details };
}

/**
 * GET /api/chamados/preventivas/gerar
 * Cron do Vercel (Authorization: Bearer <CRON_SECRET>) ou disparo manual
 * por admin/ti/manutencao ("Gerar agora"). Mesmo padrão de app/api/chat-interno/expurgo.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`
    ) {
      const summary = await runGeracao();
      return NextResponse.json({ ok: true, cron: true, ...summary });
    }

    const profile = await requireStaff();
    if (!PLAN_MANAGER_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const summary = await runGeracao();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return apiError(err);
  }
}
