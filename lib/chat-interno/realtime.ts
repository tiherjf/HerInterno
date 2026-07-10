import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Realtime broadcast do chat interno (server-side) ─────────
// Envia eventos no canal pessoal do usuário (`chat:user:<id>`) via REST,
// sem precisar de subscribe. Tudo aqui é melhor esforço: nunca quebra o
// fluxo principal (mensagem já persistida) se o Realtime estiver fora.
// Mesmo padrão de lib/chamados/realtime.ts.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimeCapableClient = Pick<SupabaseClient<any, any, any, any, any>, "channel" | "removeChannel">;

/**
 * Emite um broadcast no canal do usuário. Melhor esforço: nunca lança erro.
 * Eventos usados: "message" (nova mensagem), "read" (mensagens lidas).
 */
export async function broadcastToUser(
  svc: RealtimeCapableClient,
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const channel = svc.channel(`chat:user:${userId}`);
    try {
      try {
        // supabase-js 2.108: httpSend envia broadcast via REST sem subscribe
        await channel.httpSend(event, payload);
      } catch {
        // Fallback para servidores Realtime mais antigos
        await channel.send({ type: "broadcast", event, payload });
      }
    } finally {
      try {
        await svc.removeChannel(channel);
      } catch {
        // limpeza é melhor esforço
      }
    }
  } catch {
    // Realtime indisponível — polling do cliente cobre
  }
}
