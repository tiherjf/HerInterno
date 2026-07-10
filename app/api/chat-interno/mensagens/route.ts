import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

const MISSING_TABLE_CODES = ["PGRST205", "42P01"];
const PAGE_SIZE = 50;
const MAX_CONTENT = 2000;

// Ids são UUIDs em produção e "dev-*" em modo dev — restringe a charset seguro
// para não quebrar a sintaxe de filtros do PostgREST.
const SAFE_ID = /^[A-Za-z0-9-]+$/;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return /chat_messages/.test(error.message ?? "") && /não existe|does not exist|schema cache/i.test(error.message ?? "");
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

    const supabase = createServiceClient();
    let query = supabase
      .from("chat_messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${withId}),and(sender_id.eq.${withId},recipient_id.eq.${profile.id})`
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (before) {
      const ts = new Date(before);
      if (isNaN(ts.getTime())) {
        return NextResponse.json({ error: "Parâmetro 'before' inválido" }, { status: 400 });
      }
      query = query.lt("created_at", ts.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ pending_migration: true, messages: [], has_more: false });
      }
      throw error;
    }

    const messages = (data ?? []).slice().reverse(); // asc para exibição
    return NextResponse.json({ messages, has_more: (data ?? []).length === PAGE_SIZE });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * POST /api/chat-interno/mensagens
 * Body: { to, content } — persiste e faz broadcast (melhor esforço) no canal do destinatário.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const { to, content } = await req.json();

    if (typeof to !== "string" || !SAFE_ID.test(to)) {
      return NextResponse.json({ error: "Destinatário inválido" }, { status: 400 });
    }
    if (to === profile.id) {
      return NextResponse.json({ error: "Não é possível enviar mensagem para si mesmo" }, { status: 400 });
    }
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }
    if (text.length > MAX_CONTENT) {
      return NextResponse.json({ error: `Mensagem excede ${MAX_CONTENT} caracteres` }, { status: 400 });
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

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({ sender_id: profile.id, recipient_id: to, content: text })
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: "Execute a migração 039 no Supabase para ativar o chat.", pending_migration: true },
          { status: 503 }
        );
      }
      throw error;
    }

    // Broadcast server-side (HTTP, sem subscribe) — melhor esforço; o polling cobre falhas
    try {
      const channel = supabase.channel(`chat:user:${to}`);
      await channel.send({ type: "broadcast", event: "message", payload: message });
      await supabase.removeChannel(channel);
    } catch {
      /* realtime indisponível — mensagem já persistida */
    }

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
