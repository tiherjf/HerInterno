import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { broadcastToUser } from "@/lib/chat-interno/realtime";

const MISSING_TABLE_CODES = ["PGRST205", "42P01"];
const PAGE_SIZE = 50;
const MAX_CONTENT = 2000;
const MIN_URGENT_REASON = 5;
const MAX_URGENT_REASON = 300;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

// Colunas base (migração 039) e completas (039 + 040)
const BASE_COLUMNS = "id, sender_id, recipient_id, content, created_at, read_at";
const FULL_COLUMNS = `${BASE_COLUMNS}, attachment_path, attachment_name, attachment_size, urgent, urgent_reason`;

// Ids são UUIDs em produção e "dev-*" em modo dev — restringe a charset seguro
// para não quebrar a sintaxe de filtros do PostgREST.
const SAFE_ID = /^[A-Za-z0-9-]+$/;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return /chat_messages/.test(error.message ?? "") && /não existe|does not exist|schema cache/i.test(error.message ?? "");
}

/**
 * Detecta coluna inexistente das melhorias do chat (migração 040 não aplicada).
 * Postgres: 42703 (undefined_column); PostgREST: PGRST204 (fora do schema cache).
 * Mesmo padrão de erroColunaAgenda em components/corpo-clinico/agenda.ts.
 */
function erroColuna040(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (e.code === "42703" || e.code === "PGRST204") && /attachment|urgent/.test(msg);
}

/**
 * GET /api/chat-interno/mensagens?with=<userId>&before=<iso?>
 * Histórico paginado (50) entre mim e o interlocutor, ordenado asc para exibição.
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const withId = req.nextUrl.searchParams.get("with") ?? "";
    const before = req.nextUrl.searchParams.get("before");

    if (!SAFE_ID.test(withId)) {
      return NextResponse.json({ error: "Parâmetro 'with' inválido" }, { status: 400 });
    }

    let beforeIso: string | null = null;
    if (before) {
      const ts = new Date(before);
      if (isNaN(ts.getTime())) {
        return NextResponse.json({ error: "Parâmetro 'before' inválido" }, { status: 400 });
      }
      beforeIso = ts.toISOString();
    }

    const supabase = createServiceClient();
    const buildQuery = (columns: string) => {
      let query = supabase
        .from("chat_messages")
        .select(columns)
        .or(
          `and(sender_id.eq.${profile.id},recipient_id.eq.${withId}),and(sender_id.eq.${withId},recipient_id.eq.${profile.id})`
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (beforeIso) query = query.lt("created_at", beforeIso);
      return query;
    };

    let pendingMigration040 = false;
    let { data, error } = await buildQuery(FULL_COLUMNS);
    if (error && erroColuna040(error)) {
      // Migração 040 pendente — segue com as colunas da 039
      pendingMigration040 = true;
      ({ data, error } = await buildQuery(BASE_COLUMNS));
    }
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ pending_migration: true, messages: [], has_more: false });
      }
      throw error;
    }

    const messages = (data ?? []).slice().reverse(); // asc para exibição
    return NextResponse.json({
      messages,
      has_more: (data ?? []).length === PAGE_SIZE,
      ...(pendingMigration040 ? { pending_migration_040: true } : {}),
    });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * POST /api/chat-interno/mensagens
 * Body: { to, content?, attachment_path?, attachment_name?, attachment_size?,
 *         urgent?, urgent_reason? }
 * Persiste e faz broadcast (melhor esforço) no canal do destinatário.
 * Regras: conteúdo obrigatório se não houver anexo; anexo deve ter sido
 * enviado pelo próprio remetente (path começa com "<meu id>/"); mensagem
 * urgente exige motivo (≥5 caracteres) e é registrada em activity_logs.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const body = await req.json();
    const { to, content, attachment_path, attachment_name, attachment_size, urgent, urgent_reason } = body ?? {};

    if (typeof to !== "string" || !SAFE_ID.test(to)) {
      return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });
    }
    if (to === profile.id) {
      return NextResponse.json({ error: "Não é possível enviar mensagem para si mesmo" }, { status: 400 });
    }

    const text = typeof content === "string" ? content.trim() : "";
    if (text.length > MAX_CONTENT) {
      return NextResponse.json({ error: `Mensagem excede ${MAX_CONTENT} caracteres` }, { status: 400 });
    }

    // Anexo (opcional): valida que o path pertence ao remetente
    const hasAttachment = attachment_path !== undefined && attachment_path !== null && attachment_path !== "";
    let attachment: { attachment_path: string; attachment_name: string; attachment_size: number } | null = null;
    if (hasAttachment) {
      if (
        typeof attachment_path !== "string" ||
        attachment_path.includes("..") ||
        !attachment_path.startsWith(`${profile.id}/`)
      ) {
        return NextResponse.json({ error: "Anexo inválido" }, { status: 400 });
      }
      const name = typeof attachment_name === "string" ? attachment_name.trim().slice(0, 200) : "";
      const size = typeof attachment_size === "number" && Number.isFinite(attachment_size)
        ? Math.round(attachment_size)
        : 0;
      if (!name || size <= 0 || size > MAX_ATTACHMENT_SIZE) {
        return NextResponse.json({ error: "Anexo inválido" }, { status: 400 });
      }
      attachment = { attachment_path, attachment_name: name, attachment_size: size };
    }

    if (!text && !attachment) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    // Chamada urgente (fura o status "ocupado"): exige motivo
    const isUrgent = urgent === true;
    let reason = "";
    if (isUrgent) {
      reason = typeof urgent_reason === "string" ? urgent_reason.trim() : "";
      if (reason.length < MIN_URGENT_REASON) {
        return NextResponse.json(
          { error: `Informe o motivo da urgência (mínimo ${MIN_URGENT_REASON} caracteres)` },
          { status: 400 }
        );
      }
      if (reason.length > MAX_URGENT_REASON) {
        return NextResponse.json(
          { error: `Motivo excede ${MAX_URGENT_REASON} caracteres` },
          { status: 400 }
        );
      }
    }

    const supabase = createServiceClient();

    const { data: recipient } = await supabase
      .from("profiles")
      .select("id, active")
      .eq("id", to)
      .single();

    if (!recipient || !recipient.active) {
      return NextResponse.json({ error: "Destinatário não encontrado ou inativo" }, { status: 404 });
    }

    const baseRow = { sender_id: profile.id, recipient_id: to, content: text };
    const needs040 = !!attachment || isUrgent;
    const fullRow = needs040
      ? { ...baseRow, ...(attachment ?? {}), urgent: isUrgent, urgent_reason: isUrgent ? reason : null }
      : baseRow;

    let { data: message, error } = await supabase
      .from("chat_messages")
      .insert(fullRow)
      .select(FULL_COLUMNS)
      .single();

    if (error && erroColuna040(error)) {
      if (needs040) {
        return NextResponse.json(
          {
            error: "Execute a migração 040 no Supabase para ativar anexos e chamadas urgentes.",
            pending_migration_040: true,
          },
          { status: 503 }
        );
      }
      // Migração 040 pendente, mensagem simples — insere com colunas da 039
      ({ data: message, error } = await supabase
        .from("chat_messages")
        .insert(baseRow)
        .select(BASE_COLUMNS)
        .single());
    }

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: "Execute a migração 039 no Supabase para ativar o chat.", pending_migration: true },
          { status: 503 }
        );
      }
      throw error;
    }

    // Auditoria: furar o status "ocupado" fica registrado (melhor esforço)
    if (isUrgent) {
      try {
        await supabase.from("activity_logs").insert({
          user_id: profile.id,
          user_type: "staff",
          action: "chat_chamada_urgente",
          module: "chat_interno",
          metadata: { to, reason },
        });
      } catch {
        /* auditoria é melhor esforço */
      }
    }

    // Broadcast server-side (REST, sem subscribe) — melhor esforço; o polling cobre falhas
    await broadcastToUser(supabase, to, "message", {
      ...(message as unknown as Record<string, unknown>),
      sender_name: profile.full_name,
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
