import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { erroColuna040, isMissingTable } from "@/lib/chat-interno/colunas";
import { resumirConversas } from "@/lib/chat-interno/conversas";
import type { Mensagem } from "@/lib/chat-interno/tipos";

const COLUNAS_RESUMO = "id, sender_id, recipient_id, content, created_at, read_at, attachment_name";
const COLUNAS_RESUMO_040 = `${COLUNAS_RESUMO}, urgent`;

/**
 * GET /api/chat-interno
 * Lista de conversas do usuário (última mensagem por interlocutor, não lidas e
 * se há urgente não lido) e diretório completo de colaboradores ativos.
 */
export async function GET() {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();

    const { data: directory, error: dirError } = await supabase
      .from("profiles")
      .select("id, full_name, sector, role, phone_ext")
      .eq("active", true)
      .order("full_name");
    if (dirError) throw dirError;

    const me = {
      id: profile.id,
      full_name: profile.full_name,
      sector: profile.sector ?? "",
      role: profile.role,
      phone_ext: profile.phone_ext ?? "",
    };

    // Mensagens recentes envolvendo o usuário — reduzidas para 1 conversa por interlocutor
    const buscar = (colunas: string) =>
      supabase
        .from("chat_messages")
        .select(colunas)
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(1000);

    let { data: recent, error: msgError } = await buscar(COLUNAS_RESUMO_040);
    // Migração 040 pendente: sem urgent/attachment_name
    if (msgError && erroColuna040(msgError)) {
      ({ data: recent, error: msgError } = await buscar("id, sender_id, recipient_id, content, created_at, read_at"));
    }

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

    return NextResponse.json({
      me,
      directory: directory ?? [],
      conversations: resumirConversas((recent ?? []) as unknown as Mensagem[], profile.id),
    });
  } catch (err) {
    return apiError(err);
  }
}
