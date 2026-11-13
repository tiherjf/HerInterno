/**
 * Aviso de mensagem nova enviado pelo tempo real.
 *
 * Os canais `chat:user:<id>` são públicos (qualquer usuário logado pode
 * assiná-los), então o broadcast nunca leva conteúdo: só o suficiente para o
 * destinatário buscar a mensagem em GET /api/chat-interno/mensagens/<id>,
 * que confere a permissão.
 */
export interface AvisoMensagem {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  urgent: boolean;
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

export function avisoDeMensagem(row: Record<string, unknown>): AvisoMensagem {
  return {
    id: texto(row.id),
    sender_id: texto(row.sender_id),
    recipient_id: texto(row.recipient_id),
    created_at: texto(row.created_at),
    urgent: row.urgent === true,
  };
}

/** Só remetente e destinatário veem a mensagem. */
export function podeVerMensagem(row: { sender_id: string; recipient_id: string }, userId: string): boolean {
  return !!userId && (row.sender_id === userId || row.recipient_id === userId);
}
