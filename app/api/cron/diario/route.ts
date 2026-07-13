import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Agregador de tarefas diárias.
// O plano Hobby do Vercel permite poucos cron jobs, todos no máximo 1x/dia,
// então um único cron chama este endpoint e ele dispara as rotinas internas.
// Cada rotina já valida o header Authorization: Bearer <CRON_SECRET>.
const JOBS = [
  "/api/qualidade/notificacoes",
  "/api/chat-interno/expurgo",
  "/api/chamados/alertas-sla",
  "/api/chamados/preventivas/gerar",
];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // URL base do próprio deployment
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(req.url).origin;

  const results: Record<string, unknown> = {};
  for (const path of JOBS) {
    try {
      const r = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      results[path] = { status: r.status, body: await r.json().catch(() => null) };
    } catch (err) {
      results[path] = { error: err instanceof Error ? err.message : "falha" };
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
