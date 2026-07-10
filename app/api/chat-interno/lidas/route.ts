import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { broadcastToUser } from "@/lib/chat-interno/realtime";

const MISSING_TABLE_CODES = ["PGRST205", "42P01"];
const SAFE_ID = /^[A-Za-z0-9-]+$/;

/**
 * POST /api/chat-interno/lidas
 * Body: { with } — marca como lidas todas as mensagens enviadas por `with` para mim.
 */
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const { with: withId } = await req.json();

    if (typeof withId !== "string" || !SAFE_ID.test(withId)) {
      return NextResponse.json({ error: "Parâmetro 'with' inválido" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", withId)
      .eq("recipient_id", profile.id)
      .is("read_at", null);

    if (error) {
      // Migração pendente — não quebra o cliente
      if (error.code && MISSING_TABLE_CODES.includes(error.code)) {
        return NextResponse.json({ ok: true, pending_migration: true });
      }
      throw error;
    }

    // Confirmação de leitura para o remetente (✓✓ ao vivo) — melhor esforço
    await broadcastToUser(supabase, withId, "read", { by: profile.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
