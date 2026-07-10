import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Realtime broadcast de chamados ──────────────────────────
// Envia eventos de broadcast via REST (sem precisar de subscribe) para que
// clientes conectados atualizem a tela em tempo real. Tudo aqui é melhor
// esforço: nunca quebra o fluxo principal (criação de comentário, mudança
// de status etc.) se o Realtime estiver indisponível.

export type TicketBroadcastKind = "comment" | "status" | "attachment";

// Aceita tanto o client do supabase-js quanto o do @supabase/ssr
// (createServiceClient) sem brigar com os generics de schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeCapableClient = Pick<SupabaseClient<any, any, any, any, any>, "channel" | "removeChannel">;

async function sendToTopic(
  svc: RealtimeCapableClient,
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = svc.channel(topic);
  try {
    try {
      // supabase-js 2.108: httpSend envia broadcast via REST sem subscribe
      // (POST /realtime/v1/api/broadcast/<topic>/events/<event>).
      await channel.httpSend("update", payload);
    } catch {
      // Fallback para servidores Realtime mais antigos: send() sem subscribe
      // usa o endpoint REST legado (POST /realtime/v1/api/broadcast).
      await channel.send({ type: "broadcast", event: "update", payload });
    }
  } finally {
    try {
      await svc.removeChannel(channel);
    } catch {
      // ignora — limpeza é melhor esforço
    }
  }
}

/**
 * Notifica clientes conectados que um chamado mudou.
 * Emite no canal do chamado (`ticket:<id>`) e no canal global
 * (`tickets:global`, usado para atualizar listas).
 * Melhor esforço: nunca lança erro.
 */
export async function broadcastTicketUpdate(
  svc: RealtimeCapableClient,
  ticketId: string,
  kind: TicketBroadcastKind,
): Promise<void> {
  try {
    const payload = { ticketId, kind, at: new Date().toISOString() };
    await Promise.all([
      sendToTopic(svc, `ticket:${ticketId}`, payload),
      sendToTopic(svc, "tickets:global", payload),
    ]);
  } catch {
    // Realtime é melhor esforço — não quebra o fluxo principal
  }
}
