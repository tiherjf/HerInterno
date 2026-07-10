import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

// Códigos de erro quando a tabela chat_messages ainda não existe (migração 039 pendente)
const MISSING_TABLE_CODES = ["PGRST205", "42P01"];

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return /chat_messages/.test(error.message ?? "") && /não existe|does not exist|schema cache/i.test(error.message ?? "");
}

interface ChatMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

/**
 * GET /api/chat-interno
 * Lista de conversas do usuário (última mensagem por interlocutor + não lidas)
 * e diretório completo de colaboradores ativos agrupável por setor.
 */
export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();

    const { data: directory, error: dirError } = await supabase
      .from("profiles")
      .select("id, full_name, sector, role")
      .eq("active", true)
      .order("full_name");
    if (dirError) throw dirError;

    const me = {
      id: profile.id,
      full_name: profile.full_name,
      sector: profile.sector ?? "",
      role: profile.role,
    };

    // Mensagens recentes envolvendo o usuário — reduzidas para 1 conversa por interlocutor
    const { data: recent, error: msgError } = await supabase
      .from("chat_messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (msgError) {
      if (isMissingTable(msgError)) {
        return NextResponse.json({
          pending_migration: true,
          me,
          directory: directory ?? [],
          conversations: [],
        });
      }
      throw msgError;
    }

    const byCounterpart = new Map<string, { with: string; last_message: ChatMessageRow; unread: number }>();
    for (const msg of (recent ?? []) as ChatMessageRow[]) {
      const other = msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id;
      let conv = byCounterpart.get(other);
      if (!conv) {
        conv = { with: other, last_message: msg, unread: 0 };
        byCounterpart.set(other, conv);
      }
      if (msg.recipient_id === profile.id && !msg.read_at) conv.unread += 1;
    }

    return NextResponse.json({
      me,
      directory: directory ?? [],
      conversations: Array.from(byCounterpart.values()),
    });
  } catch (err) {
    return apiError(err);
  }
}
