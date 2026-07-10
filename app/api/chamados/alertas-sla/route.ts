import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { sendEmail } from "@/lib/email/resend";
import { chamadoSlaAlertaEmail, type ChamadoSlaAlertaTicket } from "@/lib/email/templates/chamado-sla";

// Alerta quando >= 75% do prazo de SLA foi consumido (ou já estourou)
const LIMIAR_ALERTA = 0.75;

interface TicketRow {
  id: string;
  number: number;
  title: string;
  status: string;
  team: string | null;
  created_at: string;
  sla_deadline: string;
  assigned_to: string | null;
  requester_name: string | null;
}

// Coluna sla_alerted_at inexistente (migração 041 pendente) — mesmo padrão
// de erroColunaAgenda em components/corpo-clinico/agenda.ts
function erroColuna041(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (e.code === "42703" || e.code === "PGRST204") && /sla_alerted|waiting_since/.test(msg);
}

function pctElapsed(createdAt: string, deadline: string, nowMs: number): number {
  const created = new Date(createdAt).getTime();
  const limit = new Date(deadline).getTime();
  const span = limit - created;
  if (!Number.isFinite(span) || span <= 0) return nowMs >= limit ? 100 : 0;
  return ((nowMs - created) / span) * 100;
}

/**
 * Verifica chamados abertos/em atendimento com SLA prestes a estourar
 * (>= 75% do prazo consumido) ou já estourado e ainda não alertados,
 * e envia UM e-mail por agente listando seus chamados. Chamados sem
 * responsável vão para todos os agentes ativos do time.
 */
async function runAlertas() {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("tickets")
    .select("id, number, title, status, team, created_at, sla_deadline, assigned_to, requester_name")
    .in("status", ["open", "in_progress"])
    .not("sla_deadline", "is", null)
    .is("sla_alerted_at", null);

  if (error) {
    if (erroColuna041(error)) return { pending_migration: true };
    throw error;
  }

  const tickets = (data ?? []) as TicketRow[];
  const nowMs = Date.now();

  const alertaveis = tickets.filter((t) => {
    if (t.status === "waiting_user") return false; // SLA pausado
    return pctElapsed(t.created_at, t.sla_deadline, nowMs) >= LIMIAR_ALERTA * 100;
  });

  if (alertaveis.length === 0) {
    return { checked: tickets.length, alerted: 0, emailsSent: 0 };
  }

  // Agrupa por destinatário: responsável direto ou todos os agentes ativos do time
  const porDestinatario = new Map<string, TicketRow[]>();
  const agentesPorTime = new Map<string, string[]>();

  const addTicket = (recipientId: string, ticket: TicketRow) => {
    const list = porDestinatario.get(recipientId) ?? [];
    list.push(ticket);
    porDestinatario.set(recipientId, list);
  };

  for (const ticket of alertaveis) {
    if (ticket.assigned_to) {
      addTicket(ticket.assigned_to, ticket);
      continue;
    }
    const team = ticket.team;
    if (!team) continue;
    let ids = agentesPorTime.get(team);
    if (!ids) {
      const { data: agentes } = await svc
        .from("profiles")
        .select("id")
        .eq("role", team)
        .eq("active", true);
      ids = (agentes ?? []).map((a: { id: string }) => a.id);
      agentesPorTime.set(team, ids);
    }
    for (const id of ids) addTicket(id, ticket);
  }

  // Nomes dos destinatários em uma única consulta
  const recipientIds = Array.from(porDestinatario.keys());
  const { data: perfis } = await svc
    .from("profiles")
    .select("id, full_name")
    .in("id", recipientIds);
  const nomes = new Map<string, string>(
    (perfis ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Agente"])
  );

  // Envio best-effort: um e-mail por destinatário com a lista de chamados dele
  let emailsSent = 0;
  const ticketsAlertados = new Set<string>();

  for (const [recipientId, ticketList] of Array.from(porDestinatario.entries())) {
    try {
      const { data: authUser } = await svc.auth.admin.getUserById(recipientId);
      const email = authUser?.user?.email;
      if (!email) continue;

      const items: ChamadoSlaAlertaTicket[] = ticketList.map((t) => ({
        number: t.number,
        title: t.title,
        deadline: t.sla_deadline,
        requesterName: t.requester_name,
        pctElapsed: pctElapsed(t.created_at, t.sla_deadline, nowMs),
      }));

      const { subject, html } = chamadoSlaAlertaEmail({
        recipientName: nomes.get(recipientId) ?? "Agente",
        tickets: items,
      });

      await sendEmail({ to: email, subject, html });
      emailsSent++;
      for (const t of ticketList) ticketsAlertados.add(t.id);
    } catch {
      // melhor esforço — falha em um destinatário não bloqueia os demais
    }
  }

  // Marca os chamados alertados (apenas os que tiveram ao menos uma tentativa de envio)
  if (ticketsAlertados.size > 0) {
    await svc
      .from("tickets")
      .update({ sla_alerted_at: new Date().toISOString() })
      .in("id", Array.from(ticketsAlertados));
  }

  return { checked: tickets.length, alerted: ticketsAlertados.size, emailsSent };
}

/**
 * GET /api/chamados/alertas-sla
 * Cron do Vercel (Authorization: Bearer <CRON_SECRET>) ou disparo manual
 * por admin/ti. Mesmo padrão de app/api/chat-interno/expurgo/route.ts.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`
    ) {
      const summary = await runAlertas();
      return NextResponse.json({ ok: true, cron: true, ...summary });
    }

    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const summary = await runAlertas();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return apiError(err);
  }
}
