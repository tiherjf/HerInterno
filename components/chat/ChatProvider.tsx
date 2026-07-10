"use client";

// ─── ChatProvider — presença global + inbox do chat interno ──
// Montado nos layouts /intranet e /admin: o usuário aparece online em
// qualquer página da intranet (não apenas no chat), recebe broadcasts de
// novas mensagens (contador no menu + notificação do navegador) e mantém
// o status (disponível/ausente/ocupado) com auto-ausente por inatividade.
// Tudo de realtime é melhor esforço: com o Realtime fora do ar, o app
// continua funcionando (polling da página de chat cobre as mensagens).

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// ─── Tipos ──────────────────────────────────────────────────
export type ChatStatus = "disponivel" | "ausente" | "ocupado";

export interface ChatMe {
  id: string;
  name: string;
  sector: string;
}

export interface PresenceMeta {
  user_id: string;
  name: string;
  sector: string;
  status: ChatStatus;
}

/** Mensagem recebida via broadcast (linha do banco + nome do remetente). */
export interface ChatBroadcastMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  urgent?: boolean;
  urgent_reason?: string | null;
  sender_name?: string;
}

interface ChatContextValue {
  me: ChatMe;
  /** user_id → metadados de presença (quem está online agora) */
  onlineMap: Record<string, PresenceMeta>;
  /** Status efetivo (inclui auto-ausente por inatividade) */
  myStatus: ChatStatus;
  setMyStatus: (status: ChatStatus) => void;
  /** user_id → mensagens não lidas daquele remetente */
  unreadFrom: Record<string, number>;
  totalUnread: number;
  clearUnread: (userId: string) => void;
  /** Substitui os contadores pelos valores do servidor (polling da página) */
  syncUnread: (counts: Record<string, number>) => void;
  /** Conversa aberta na página de chat: mensagens dela não contam como não lidas */
  setActiveConversation: (userId: string | null) => void;
  /** Assina toda mensagem recebida via broadcast; retorna unsubscribe */
  subscribeMessages: (cb: (msg: ChatBroadcastMessage) => void) => () => void;
  /** Assina eventos "read" (fulano leu minhas mensagens); retorna unsubscribe */
  subscribeReads: (cb: (by: string) => void) => () => void;
  /** user_id → timestamp do último evento "digitando" (expira em ~4s) */
  typingFrom: Record<string, number>;
}

const STATUS_KEY = "chat-interno-status";
const TYPING_TTL = 4000;
const AUTO_AWAY_MS = 10 * 60 * 1000; // 10 minutos sem atividade

function isStatus(v: unknown): v is ChatStatus {
  return v === "disponivel" || v === "ausente" || v === "ocupado";
}

const ChatContext = createContext<ChatContextValue | null>(null);

/** Contexto completo do chat (null fora do provider). */
export function useChatContext(): ChatContextValue | null {
  return useContext(ChatContext);
}

/** Total de não lidas — seguro fora do provider (retorna 0). */
export function useChatUnread(): number {
  const ctx = useContext(ChatContext);
  return ctx?.totalUnread ?? 0;
}

// ─── Provider ───────────────────────────────────────────────
export function ChatProvider({ me, children }: { me: ChatMe; children: React.ReactNode }) {
  const [onlineMap, setOnlineMap] = useState<Record<string, PresenceMeta>>({});
  const [myStatus, setMyStatusState] = useState<ChatStatus>("disponivel");
  const [unreadFrom, setUnreadFrom] = useState<Record<string, number>>({});
  const [typingFrom, setTypingFrom] = useState<Record<string, number>>({});

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const manualStatusRef = useRef<ChatStatus>("disponivel");
  const autoAwayRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const activeConvRef = useRef<string | null>(null);
  const msgSubsRef = useRef(new Set<(msg: ChatBroadcastMessage) => void>());
  const readSubsRef = useRef(new Set<(by: string) => void>());

  // ─── Presença: track do meu status ────────────────────────
  const trackStatus = useCallback((status: ChatStatus) => {
    try {
      presenceChannelRef.current?.track({
        user_id: me.id,
        name: me.name,
        sector: me.sector ?? "",
        status,
      });
    } catch {
      /* realtime indisponível — usuário aparece offline */
    }
  }, [me.id, me.name, me.sector]);

  const setMyStatus = useCallback((status: ChatStatus) => {
    manualStatusRef.current = status;
    autoAwayRef.current = false;
    setMyStatusState(status);
    try {
      localStorage.setItem(STATUS_KEY, status);
    } catch { /* storage indisponível */ }
    trackStatus(status);
  }, [trackStatus]);

  // Status salvo (antes de assinar a presença, para track inicial correto)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STATUS_KEY);
      if (isStatus(saved)) {
        manualStatusRef.current = saved;
        setMyStatusState(saved);
      }
    } catch { /* storage indisponível */ }
  }, []);

  // ─── Canais realtime: presença + inbox ────────────────────
  useEffect(() => {
    if (!me.id) return;
    let client: SupabaseClient | null = null;
    let presenceChannel: RealtimeChannel | null = null;
    let msgChannel: RealtimeChannel | null = null;

    try {
      client = createClient();

      presenceChannel = client.channel("presence:intranet", {
        config: { presence: { key: me.id } },
      });
      presenceChannel.on("presence", { event: "sync" }, () => {
        try {
          const state = presenceChannel!.presenceState<PresenceMeta>();
          const map: Record<string, PresenceMeta> = {};
          for (const key of Object.keys(state)) {
            const metas = state[key];
            const meta = metas[metas.length - 1];
            if (meta?.user_id) {
              map[meta.user_id] = {
                user_id: meta.user_id,
                name: meta.name ?? "",
                sector: meta.sector ?? "",
                status: isStatus(meta.status) ? meta.status : "disponivel",
              };
            }
          }
          setOnlineMap(map);
        } catch {
          /* estado de presença indisponível */
        }
      });
      presenceChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          try {
            presenceChannel!.track({
              user_id: me.id,
              name: me.name,
              sector: me.sector ?? "",
              status: autoAwayRef.current ? "ausente" : manualStatusRef.current,
            });
          } catch { /* track falhou */ }
        }
      });
      presenceChannelRef.current = presenceChannel;

      msgChannel = client.channel(`chat:user:${me.id}`);
      msgChannel.on("broadcast", { event: "message" }, ({ payload }) => {
        try {
          handleIncoming(payload as ChatBroadcastMessage);
        } catch { /* payload inesperado */ }
      });
      msgChannel.on("broadcast", { event: "typing" }, ({ payload }) => {
        try {
          const from = (payload as { from?: string })?.from;
          if (typeof from !== "string" || !from) return;
          const now = Date.now();
          setTypingFrom(prev => ({ ...prev, [from]: now }));
          // Expira sozinho após o TTL (sem novo evento)
          setTimeout(() => {
            setTypingFrom(prev => {
              if ((prev[from] ?? 0) > now) return prev; // evento mais novo chegou
              const next = { ...prev };
              delete next[from];
              return next;
            });
          }, TYPING_TTL + 200);
        } catch { /* melhor esforço */ }
      });
      msgChannel.on("broadcast", { event: "read" }, ({ payload }) => {
        try {
          const by = (payload as { by?: string })?.by;
          if (typeof by !== "string" || !by) return;
          readSubsRef.current.forEach(cb => {
            try { cb(by); } catch { /* assinante quebrado */ }
          });
        } catch { /* melhor esforço */ }
      });
      msgChannel.subscribe();
    } catch {
      // Realtime inacessível — app segue funcionando (polling na página de chat)
    }

    return () => {
      try {
        if (client && presenceChannel) client.removeChannel(presenceChannel);
        if (client && msgChannel) client.removeChannel(msgChannel);
      } catch { /* cleanup melhor esforço */ }
      presenceChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, me.name, me.sector]);

  // ─── Mensagem recebida ─────────────────────────────────────
  function handleIncoming(msg: ChatBroadcastMessage) {
    if (!msg?.id || !msg.sender_id) return;

    // Assinantes (página de chat) recebem toda mensagem
    msgSubsRef.current.forEach(cb => {
      try { cb(msg); } catch { /* assinante quebrado */ }
    });

    // Contador: mensagens da conversa aberta são consumidas pela página
    if (activeConvRef.current !== msg.sender_id) {
      setUnreadFrom(prev => ({
        ...prev,
        [msg.sender_id]: (prev[msg.sender_id] ?? 0) + 1,
      }));
    }

    // Notificação do navegador: urgente sempre; demais só com aba oculta
    // ou fora da página do chat
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    const onChatPage = pathnameRef.current === "/intranet/chat";
    if (msg.urgent || hidden || !onChatPage) {
      fireNotification(msg);
    }
  }

  function fireNotification(msg: ChatBroadcastMessage) {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const sender = msg.sender_name || "Nova mensagem";
      const title = msg.urgent ? `🚨 URGENTE — ${sender}` : sender;
      const preview = msg.content
        ? (msg.content.length > 90 ? `${msg.content.slice(0, 90)}…` : msg.content)
        : (msg.attachment_name ? `📎 ${msg.attachment_name}` : "Nova mensagem");
      const n = new Notification(title, { body: preview, tag: `chat-${msg.sender_id}` });
      n.onclick = () => {
        try {
          window.focus();
          n.close();
        } catch { /* melhor esforço */ }
      };
    } catch {
      /* Notification bloqueada/indisponível */
    }
  }

  // Permissão de notificação: pedida na primeira interação do usuário
  useEffect(() => {
    function requestOnce() {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      } catch { /* indisponível */ }
      window.removeEventListener("pointerdown", requestOnce);
      window.removeEventListener("keydown", requestOnce);
    }
    window.addEventListener("pointerdown", requestOnce);
    window.addEventListener("keydown", requestOnce);
    return () => {
      window.removeEventListener("pointerdown", requestOnce);
      window.removeEventListener("keydown", requestOnce);
    };
  }, []);

  // ─── Auto-ausente após 10 min sem atividade ────────────────
  useEffect(() => {
    function onActivity() {
      lastActivityRef.current = Date.now();
      // Volta do auto-ausente (nunca mexe em ausente/ocupado manuais)
      if (autoAwayRef.current && manualStatusRef.current === "disponivel") {
        autoAwayRef.current = false;
        setMyStatusState("disponivel");
        trackStatus("disponivel");
      }
    }
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    document.addEventListener("visibilitychange", onActivity);

    const interval = setInterval(() => {
      if (
        manualStatusRef.current === "disponivel" &&
        !autoAwayRef.current &&
        Date.now() - lastActivityRef.current >= AUTO_AWAY_MS
      ) {
        autoAwayRef.current = true;
        setMyStatusState("ausente");
        trackStatus("ausente"); // temporário: localStorage continua "disponivel"
      }
    }, 30_000);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
      document.removeEventListener("visibilitychange", onActivity);
      clearInterval(interval);
    };
  }, [trackStatus]);

  // ─── Contagem inicial de não lidas ─────────────────────────
  useEffect(() => {
    if (!me.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/chat-interno", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || json.pending_migration) return;
        const counts: Record<string, number> = {};
        for (const c of (json.conversations ?? []) as { with: string; unread: number }[]) {
          if (c.unread > 0) counts[c.with] = c.unread;
        }
        // Mescla com incrementos que chegaram via broadcast antes do fetch
        setUnreadFrom(prev => {
          const next = { ...counts };
          for (const [id, n] of Object.entries(prev)) {
            next[id] = Math.max(next[id] ?? 0, n);
          }
          if (activeConvRef.current) delete next[activeConvRef.current];
          return next;
        });
      } catch {
        /* rede indisponível — contador fica em 0 até o próximo sync */
      }
    })();
    return () => { cancelled = true; };
  }, [me.id]);

  // ─── API do contexto ───────────────────────────────────────
  const clearUnread = useCallback((userId: string) => {
    setUnreadFrom(prev => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const syncUnread = useCallback((counts: Record<string, number>) => {
    setUnreadFrom(() => {
      const next: Record<string, number> = {};
      for (const [id, n] of Object.entries(counts)) {
        if (n > 0 && id !== activeConvRef.current) next[id] = n;
      }
      return next;
    });
  }, []);

  const setActiveConversation = useCallback((userId: string | null) => {
    activeConvRef.current = userId;
    if (userId) clearUnread(userId);
  }, [clearUnread]);

  const subscribeMessages = useCallback((cb: (msg: ChatBroadcastMessage) => void) => {
    msgSubsRef.current.add(cb);
    return () => { msgSubsRef.current.delete(cb); };
  }, []);

  const subscribeReads = useCallback((cb: (by: string) => void) => {
    readSubsRef.current.add(cb);
    return () => { readSubsRef.current.delete(cb); };
  }, []);

  const totalUnread = useMemo(
    () => Object.values(unreadFrom).reduce((sum, n) => sum + n, 0),
    [unreadFrom]
  );

  const value = useMemo<ChatContextValue>(() => ({
    me,
    onlineMap,
    myStatus,
    setMyStatus,
    unreadFrom,
    totalUnread,
    clearUnread,
    syncUnread,
    setActiveConversation,
    subscribeMessages,
    subscribeReads,
    typingFrom,
  }), [
    me, onlineMap, myStatus, setMyStatus, unreadFrom,
    totalUnread, clearUnread, syncUnread, setActiveConversation,
    subscribeMessages, subscribeReads, typingFrom,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
