import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

const BUCKET = "chat";
const RETENTION_DAYS = 30;
const BATCH = 500; // mensagens com anexo por iteração
const STORAGE_BATCH = 100; // arquivos por chamada de remove()

const MISSING_TABLE_CODES = ["PGRST205", "42P01"];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return /chat_messages/.test(error.message ?? "") && /não existe|does not exist|schema cache/i.test(error.message ?? "");
}

// Coluna attachment_path inexistente (migração 040 pendente)
function erroColuna040(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (e.code === "42703" || e.code === "PGRST204") && /attachment/.test(msg);
}

/**
 * Expurgo do chat interno — retenção de 30 dias (LGPD).
 * Remove mensagens com mais de 30 dias e os respectivos anexos do bucket "chat".
 */
async function runExpurgo() {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let deletedMessages = 0;
  let deletedAttachments = 0;

  // 1. Mensagens antigas COM anexo: remove os arquivos do Storage antes das linhas
  for (;;) {
    const { data: rows, error } = await svc
      .from("chat_messages")
      .select("id, attachment_path")
      .lt("created_at", cutoff)
      .not("attachment_path", "is", null)
      .limit(BATCH);

    if (error) {
      if (erroColuna040(error)) break; // migração 040 pendente — sem anexos para limpar
      if (isMissingTable(error)) return { pending_migration: true, deletedMessages, deletedAttachments };
      throw error;
    }
    if (!rows || rows.length === 0) break;

    const paths = rows
      .map((r) => r.attachment_path as string | null)
      .filter((p): p is string => !!p);

    for (let i = 0; i < paths.length; i += STORAGE_BATCH) {
      try {
        const { error: rmError } = await svc.storage
          .from(BUCKET)
          .remove(paths.slice(i, i + STORAGE_BATCH));
        if (!rmError) deletedAttachments += Math.min(STORAGE_BATCH, paths.length - i);
      } catch {
        /* melhor esforço — arquivo órfão não bloqueia o expurgo */
      }
    }

    const ids = rows.map((r) => r.id as string);
    const { error: delError, count } = await svc
      .from("chat_messages")
      .delete({ count: "exact" })
      .in("id", ids);
    if (delError) throw delError;
    deletedMessages += count ?? ids.length;

    if (rows.length < BATCH) break;
  }

  // 2. Demais mensagens antigas (sem anexo)
  const { error: delError, count } = await svc
    .from("chat_messages")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (delError) {
    if (isMissingTable(delError)) return { pending_migration: true, deletedMessages, deletedAttachments };
    throw delError;
  }
  deletedMessages += count ?? 0;

  return { deletedMessages, deletedAttachments, cutoff };
}

/**
 * GET /api/chat-interno/expurgo
 * Cron do Vercel (Authorization: Bearer <CRON_SECRET>) ou disparo manual
 * por admin/ti. Mesmo padrão de app/api/qualidade/notificacoes/route.ts.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader === `Bearer ${process.env.CRON_SECRET}`
    ) {
      const summary = await runExpurgo();
      return NextResponse.json({ ok: true, cron: true, summary });
    }

    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const summary = await runExpurgo();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return apiError(err);
  }
}
