"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Search, ChevronDown, ChevronRight, ChevronLeft,
  Send, Loader2, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// ─── Tipos ──────────────────────────────────────────────────
type Status = "disponivel" | "ausente" | "ocupado";

interface Person {
  id: string;
  full_name: string;
  sector: string | null;
  role: string;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface Conversation {
  with: string;
  last_message: ChatMessage;
  unread: number;
}

// ─── Status e cores ─────────────────────────────────────────
const STATUS_META: Record<Status, { label: string; dot: string }> = {
  disponivel: { label: "Disponível", dot: "bg-green-500" },
  ausente:    { label: "Ausente",    dot: "bg-yellow-400" },
  ocupado:    { label: "Ocupado",    dot: "bg-red-500" },
};
const OFFLINE_DOT = "bg-gray-300";
const STATUS_KEY = "chat-interno-status";

function isStatus(v: unknown): v is Status {
  return v === "disponivel" || v === "ausente" || v === "ocupado";
}

// ─── Helpers de data ────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function dayKey(iso: string) {
  return new Date(iso).toDateString();
}
function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const map = new Map<string, ChatMessage>();
  for (const m of [...existing, ...incoming]) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// ─── Página ─────────────────────────────────────────────────
export default function ChatInternoPage() {
  const [me, setMe] = useState<Person | null>(null);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [pendingMigration, setPendingMigration] = useState(false);
  const [loading, setLoading] = useState(true);

  const [presence, setPresence] = useState<Record<string, Status>>({});
  const [myStatus, setMyStatus] = useState<Status>("disponivel");

  const [selected, setSelected] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const selectedRef = useRef<string | null>(null);
  const myStatusRef = useRef<Status>("disponivel");
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(false);

  // ─── Carga inicial ────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-interno");
      const json = await res.json();
      if (!res.ok) return;
      setMe(json.me ?? null);
      setDirectory(json.directory ?? []);
      setPendingMigration(!!json.pending_migration);
      const map: Record<string, Conversation> = {};
      for (const c of (json.conversations ?? []) as Conversation[]) map[c.with] = c;
      setConversations(prev => {
        // Preserva contadores locais mais recentes que o fetch (ex.: broadcast entre polls)
        return { ...prev, ...map };
      });
    } catch {
      /* rede indisponível — mantém estado atual */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STATUS_KEY) : null;
    if (isStatus(saved)) {
      setMyStatus(saved);
      myStatusRef.current = saved;
    }
    loadInbox();
  }, [loadInbox]);

  // ─── Mensagens da conversa ────────────────────────────────
  const loadMessages = useCallback(async (withId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat-interno/mensagens?with=${encodeURIComponent(withId)}`);
      const json = await res.json();
      if (res.ok && selectedRef.current === withId) {
        setMessages(json.messages ?? []);
        setHasMore(!!json.has_more);
        if (json.pending_migration) setPendingMigration(true);
      }
    } catch {
      /* falha de rede — polling tenta de novo */
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const markRead = useCallback((withId: string) => {
    setConversations(prev => {
      const conv = prev[withId];
      if (!conv || conv.unread === 0) return prev;
      return { ...prev, [withId]: { ...conv, unread: 0 } };
    });
    fetch("/api/chat-interno/lidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ with: withId }),
    }).catch(() => {});
  }, []);

  const openConversation = useCallback((person: Person) => {
    setSelected(person);
    selectedRef.current = person.id;
    setMessages([]);
    setHasMore(false);
    setDraft("");
    loadMessages(person.id);
    markRead(person.id);
  }, [loadMessages, markRead]);

  const closeConversation = useCallback(() => {
    setSelected(null);
    selectedRef.current = null;
    setMessages([]);
  }, []);

  async function loadOlder() {
    if (!selected || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    skipScrollRef.current = true;
    try {
      const before = encodeURIComponent(messages[0].created_at);
      const res = await fetch(
        `/api/chat-interno/mensagens?with=${encodeURIComponent(selected.id)}&before=${before}`
      );
      const json = await res.json();
      if (res.ok && selectedRef.current === selected.id) {
        setMessages(prev => mergeMessages(json.messages ?? [], prev));
        setHasMore(!!json.has_more);
      }
    } catch {
      /* melhor esforço */
    } finally {
      setLoadingOlder(false);
    }
  }

  // ─── Recebimento em tempo real ────────────────────────────
  const handleIncoming = useCallback((msg: ChatMessage) => {
    if (!msg?.id || !msg.sender_id) return;
    const counterpart = msg.sender_id;
    if (selectedRef.current === counterpart) {
      setMessages(prev => mergeMessages(prev, [msg]));
      markRead(counterpart);
      setConversations(prev => ({
        ...prev,
        [counterpart]: { with: counterpart, last_message: msg, unread: 0 },
      }));
    } else {
      setConversations(prev => {
        const conv = prev[counterpart];
        return {
          ...prev,
          [counterpart]: {
            with: counterpart,
            last_message: msg,
            unread: (conv?.unread ?? 0) + 1,
          },
        };
      });
    }
  }, [markRead]);

  // ─── Realtime: presença + canal de mensagens ──────────────
  useEffect(() => {
    if (!me?.id) return;
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
          const state = presenceChannel!.presenceState<{
            user_id: string; name: string; sector: string; status: Status;
          }>();
          const map: Record<string, Status> = {};
          for (const key of Object.keys(state)) {
            const metas = state[key];
            const meta = metas[metas.length - 1];
            if (meta?.user_id) map[meta.user_id] = isStatus(meta.status) ? meta.status : "disponivel";
          }
          setPresence(map);
        } catch {
          /* estado de presença indisponível */
        }
      });
      presenceChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await presenceChannel!.track({
              user_id: me.id,
              name: me.full_name,
              sector: me.sector ?? "",
              status: myStatusRef.current,
            });
          } catch {
            /* track falhou — usuário aparece offline */
          }
        }
      });
      presenceChannelRef.current = presenceChannel;

      msgChannel = client.channel(`chat:user:${me.id}`);
      msgChannel.on("broadcast", { event: "message" }, ({ payload }) => {
        handleIncoming(payload as ChatMessage);
      });
      msgChannel.subscribe();
    } catch {
      // Realtime inacessível — página funciona com todos offline + polling
    }

    return () => {
      try {
        if (client && presenceChannel) client.removeChannel(presenceChannel);
        if (client && msgChannel) client.removeChannel(msgChannel);
      } catch {
        /* cleanup melhor esforço */
      }
      presenceChannelRef.current = null;
    };
  }, [me?.id, me?.full_name, me?.sector, handleIncoming]);

  // Alteração do meu status: persiste e re-track na presença
  function changeStatus(status: Status) {
    setMyStatus(status);
    myStatusRef.current = status;
    try {
      localStorage.setItem(STATUS_KEY, status);
    } catch { /* storage indisponível */ }
    try {
      if (me && presenceChannelRef.current) {
        presenceChannelRef.current.track({
          user_id: me.id,
          name: me.full_name,
          sector: me.sector ?? "",
          status,
        });
      }
    } catch { /* realtime indisponível */ }
  }

  // ─── Polling de fallback (30s, janela focada) ─────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hasFocus()) return;
      loadInbox();
      const withId = selectedRef.current;
      if (withId) {
        fetch(`/api/chat-interno/mensagens?with=${encodeURIComponent(withId)}`)
          .then(r => r.json())
          .then(json => {
            if (selectedRef.current === withId && json.messages) {
              setMessages(prev => mergeMessages(prev, json.messages));
            }
          })
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  // ─── Envio ────────────────────────────────────────────────
  const [sendError, setSendError] = useState("");
  async function send() {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/chat-interno/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selected.id, content: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.error ?? "Erro ao enviar.");
        if (json.pending_migration) setPendingMigration(true);
        return;
      }
      const msg: ChatMessage = json.message;
      setDraft("");
      setMessages(prev => mergeMessages(prev, [msg]));
      setConversations(prev => ({
        ...prev,
        [selected.id]: {
          with: selected.id,
          last_message: msg,
          unread: prev[selected.id]?.unread ?? 0,
        },
      }));
    } catch {
      setSendError("Falha de rede ao enviar.");
    } finally {
      setSending(false);
    }
  }

  // ─── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selected?.id]);

  // ─── Derivados: agrupamento por setor ─────────────────────
  const statusOf = useCallback(
    (id: string): Status | null => presence[id] ?? null,
    [presence]
  );

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const people = directory.filter(
      p => p.id !== me?.id && (!term || p.full_name.toLowerCase().includes(term))
    );
    const bySector = new Map<string, Person[]>();
    for (const p of people) {
      const sector = p.sector?.trim() || "Sem setor";
      if (!bySector.has(sector)) bySector.set(sector, []);
      bySector.get(sector)!.push(p);
    }
    return Array.from(bySector.entries())
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([sector, members]) => ({
        sector,
        members: members.sort((a, b) => {
          const aOn = presence[a.id] ? 0 : 1;
          const bOn = presence[b.id] ? 0 : 1;
          if (aOn !== bOn) return aOn - bOn;
          return a.full_name.localeCompare(b.full_name, "pt-BR");
        }),
        online: members.filter(m => presence[m.id]).length,
      }));
  }, [directory, me?.id, search, presence]);

  function toggleSector(sector: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  const selectedStatus = selected ? statusOf(selected.id) : null;
  const recipientOcupado = selectedStatus === "ocupado";

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-7.5rem)] min-h-[420px]">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="text-primary" size={22} />
        <h1 className="text-lg font-semibold">Chat Interno</h1>
      </div>

      {pendingMigration && (
        <div className="flex items-center gap-2 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          Execute a migração 039 no Supabase para ativar o chat.
        </div>
      )}

      <div className="flex flex-1 min-h-0 rounded-lg border bg-white overflow-hidden">
        {/* ── Painel esquerdo: status + diretório ── */}
        <div className={`${selected ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 flex-col border-r`}>
          {/* Meu status */}
          <div className="p-3 border-b space-y-2">
            <p className="text-xs font-medium text-gray-500">Meu status</p>
            <div className="flex gap-1.5">
              {(Object.keys(STATUS_META) as Status[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs transition-colors ${
                    myStatus === s
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar colaborador..."
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Diretório agrupado por setor */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum colaborador encontrado.</p>
            ) : (
              groups.map(group => {
                const isCollapsed = collapsed.has(group.sector);
                return (
                  <div key={group.sector}>
                    <button
                      type="button"
                      onClick={() => toggleSector(group.sector)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50"
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="truncate">{group.sector}</span>
                      <span className="ml-auto font-normal normal-case text-gray-400">
                        {group.online}/{group.members.length} online
                      </span>
                    </button>
                    {!isCollapsed && group.members.map(person => {
                      const status = statusOf(person.id);
                      const conv = conversations[person.id];
                      const isActive = selected?.id === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => openConversation(person)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-primary/10" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium">
                              {initials(person.full_name)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                status ? STATUS_META[status].dot : OFFLINE_DOT
                              }`}
                              title={status ? STATUS_META[status].label : "Offline"}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{person.full_name}</p>
                            {conv?.last_message && (
                              <p className="text-xs text-gray-400 truncate">
                                {conv.last_message.sender_id === me?.id ? "Você: " : ""}
                                {conv.last_message.content}
                              </p>
                            )}
                          </div>
                          {(conv?.unread ?? 0) > 0 && (
                            <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
                              {conv!.unread > 99 ? "99+" : conv!.unread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Painel direito: conversa ── */}
        <div className={`${selected ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
              <MessageCircle size={44} className="mb-3 opacity-25" />
              <p className="text-sm">Selecione um colaborador para iniciar uma conversa.</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho da conversa */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b bg-gray-50/60">
                <button
                  type="button"
                  onClick={closeConversation}
                  className="md:hidden p-1 rounded hover:bg-gray-100 text-gray-500"
                  aria-label="Voltar"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium">
                    {initials(selected.full_name)}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      selectedStatus ? STATUS_META[selectedStatus].dot : OFFLINE_DOT
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{selected.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {selected.sector || "Sem setor"} ·{" "}
                    {selectedStatus ? STATUS_META[selectedStatus].label : "Offline"}
                  </p>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 bg-gray-50/40">
                {hasMore && (
                  <div className="flex justify-center pb-2">
                    <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                      {loadingOlder && <Loader2 size={14} className="animate-spin mr-1.5" />}
                      Carregar mensagens anteriores
                    </Button>
                  </div>
                )}
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10 text-gray-400">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">
                    Nenhuma mensagem ainda. Diga olá!
                  </p>
                ) : (
                  messages.map((msg, i) => {
                    const mine = msg.sender_id === me?.id;
                    const showDay = i === 0 || dayKey(msg.created_at) !== dayKey(messages[i - 1].created_at);
                    return (
                      <div key={msg.id}>
                        {showDay && (
                          <div className="flex justify-center py-2">
                            <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">
                              {formatDay(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-white border rounded-bl-sm text-gray-800"
                            }`}
                          >
                            {msg.content}
                            <span
                              className={`block text-right text-[10px] mt-0.5 ${
                                mine ? "text-primary-foreground/60" : "text-gray-400"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Entrada */}
              <div className="border-t p-3 space-y-1.5">
                {recipientOcupado && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${STATUS_META.ocupado.dot}`} />
                    {selected.full_name.split(" ")[0]} está ocupado(a) e não pode ser chamado(a) agora.
                  </p>
                )}
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    maxLength={2000}
                    placeholder={recipientOcupado ? "Usuário ocupado..." : "Digite uma mensagem..."}
                    disabled={recipientOcupado || sending}
                  />
                  <Button
                    onClick={send}
                    disabled={recipientOcupado || sending || !draft.trim()}
                    size="icon"
                    aria-label="Enviar"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
