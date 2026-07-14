"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Search, ChevronDown, ChevronRight, ChevronLeft,
  Send, Loader2, AlertTriangle, Paperclip, FileText, X, Check, CheckCheck,
  Phone, Copy, ShieldAlert,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  useChatContext,
  type ChatBroadcastMessage,
  type ChatStatus as Status,
} from "@/components/chat/ChatProvider";

// ─── Tipos ──────────────────────────────────────────────────
interface Person {
  id: string;
  full_name: string;
  sector: string | null;
  role: string;
  phone_ext?: string | null;
}

interface ChatMessage {
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
const LGPD_KEY = "chat-lgpd-aviso-v1";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const TYPING_THROTTLE = 2000;

// ─── Helpers ────────────────────────────────────────────────
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

function formatBytes(n?: number | null) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageName(name?: string | null) {
  return /\.(jpe?g|png|webp)$/i.test(name ?? "");
}

/** Turno: expediente padrão 07:00–19:00 (hora local). */
function foraDoExpediente() {
  const h = new Date().getHours();
  return h < 7 || h >= 19;
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
  const chat = useChatContext();

  const [me, setMe] = useState<Person | null>(null);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [pendingMigration, setPendingMigration] = useState(false);
  const [pending040, setPending040] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [urgentReason, setUrgentReason] = useState("");
  const [lgpdVisible, setLgpdVisible] = useState(false);
  const [copiedExt, setCopiedExt] = useState(false);

  const selectedRef = useRef<string | null>(null);
  const meRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingReadyRef = useRef(false);
  const lastTypingSentRef = useRef(0);

  // ─── Status (presença global via ChatProvider) ────────────
  const myStatus: Status = chat?.myStatus ?? "disponivel";
  const statusOf = useCallback(
    (id: string): Status | null => chat?.onlineMap[id]?.status ?? null,
    [chat?.onlineMap]
  );
  function changeStatus(status: Status) {
    chat?.setMyStatus(status);
  }

  // ─── Carga inicial ────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-interno");
      const json = await res.json();
      if (!res.ok) return;
      setMe(json.me ?? null);
      meRef.current = json.me?.id ?? null;
      setDirectory(json.directory ?? []);
      setPendingMigration(!!json.pending_migration);
      const map: Record<string, Conversation> = {};
      const counts: Record<string, number> = {};
      for (const c of (json.conversations ?? []) as Conversation[]) {
        map[c.with] = c;
        if (c.unread > 0) counts[c.with] = c.unread;
      }
      setConversations(prev => ({ ...prev, ...map }));
      // Contadores globais (badge do menu) sincronizados com o servidor
      chat?.syncUnread(counts);
    } catch {
      /* rede indisponível — mantém estado atual */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.syncUnread]);

  useEffect(() => {
    loadInbox();
    try {
      setLgpdVisible(localStorage.getItem(LGPD_KEY) !== "1");
    } catch {
      setLgpdVisible(true);
    }
  }, [loadInbox]);

  function dismissLgpd() {
    setLgpdVisible(false);
    try {
      localStorage.setItem(LGPD_KEY, "1");
    } catch { /* storage indisponível */ }
  }

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
        if (json.pending_migration_040) setPending040(true);
      }
    } catch {
      /* falha de rede — polling tenta de novo */
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const markRead = useCallback((withId: string) => {
    chat?.clearUnread(withId);
    fetch("/api/chat-interno/lidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ with: withId }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.clearUnread]);

  const openConversation = useCallback((person: Person) => {
    setSelected(person);
    selectedRef.current = person.id;
    chat?.setActiveConversation(person.id);
    setMessages([]);
    setHasMore(false);
    setDraft("");
    setPendingFile(null);
    setSendError("");
    setUrgentOpen(false);
    loadMessages(person.id);
    markRead(person.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMessages, markRead, chat?.setActiveConversation]);

  const closeConversation = useCallback(() => {
    setSelected(null);
    selectedRef.current = null;
    chat?.setActiveConversation(null);
    setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.setActiveConversation]);

  // Ao sair da página, libera a conversa ativa no provider
  useEffect(() => {
    return () => {
      chat?.setActiveConversation(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ─── Broadcasts do provider: mensagens novas + confirmações ─
  useEffect(() => {
    if (!chat) return;
    const unsubMsg = chat.subscribeMessages((incoming: ChatBroadcastMessage) => {
      const msg: ChatMessage = incoming;
      const counterpart = msg.sender_id;
      setConversations(prev => ({
        ...prev,
        [counterpart]: { with: counterpart, last_message: msg, unread: 0 },
      }));
      if (selectedRef.current === counterpart) {
        setMessages(prev => mergeMessages(prev, [msg]));
        markRead(counterpart);
      }
    });
    const unsubRead = chat.subscribeReads((by: string) => {
      // O interlocutor leu minhas mensagens → ✓✓ ao vivo
      if (selectedRef.current !== by) return;
      const now = new Date().toISOString();
      setMessages(prev =>
        prev.map(m =>
          m.sender_id === meRef.current && !m.read_at ? { ...m, read_at: now } : m
        )
      );
    });
    return () => {
      unsubMsg();
      unsubRead();
    };
  }, [chat, markRead]);

  // ─── Canal de digitação (envia "typing" para o interlocutor) ─
  useEffect(() => {
    const otherId = selected?.id;
    typingReadyRef.current = false;
    if (!otherId || !me?.id) return;

    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    try {
      client = createClient();
      channel = client.channel(`chat:user:${otherId}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") typingReadyRef.current = true;
      });
      typingChannelRef.current = channel;
    } catch {
      /* realtime indisponível — sem indicador de digitação */
    }
    return () => {
      typingReadyRef.current = false;
      typingChannelRef.current = null;
      try {
        if (client && channel) client.removeChannel(channel);
      } catch { /* cleanup melhor esforço */ }
    };
  }, [selected?.id, me?.id]);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE) return;
    if (!typingReadyRef.current || !typingChannelRef.current || !me?.id) return;
    lastTypingSentRef.current = now;
    try {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { from: me.id },
      });
    } catch {
      /* melhor esforço */
    }
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

  // ─── Anexo pendente ───────────────────────────────────────
  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setSendError("Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setSendError("Arquivo excede o limite de 10MB.");
      return;
    }
    setSendError("");
    setPendingFile(file);
  }

  // ─── Envio ────────────────────────────────────────────────
  async function send(opts?: { urgent?: boolean; reason?: string }) {
    const text = draft.trim();
    if ((!text && !pendingFile) || !selected || sending) return;
    setSending(true);
    setSendError("");
    try {
      // 1. Upload do anexo (se houver)
      let attachment: { path: string; name: string; size: number } | null = null;
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        const upRes = await fetch("/api/chat-interno/anexos", { method: "POST", body: form });
        const upJson = await upRes.json();
        if (!upRes.ok) {
          setSendError(upJson.error ?? "Erro ao enviar anexo.");
          return;
        }
        attachment = { path: upJson.path, name: pendingFile.name, size: pendingFile.size };
      }

      // 2. Mensagem
      const res = await fetch("/api/chat-interno/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selected.id,
          content: text,
          ...(attachment
            ? {
                attachment_path: attachment.path,
                attachment_name: attachment.name,
                attachment_size: attachment.size,
              }
            : {}),
          ...(opts?.urgent ? { urgent: true, urgent_reason: opts.reason ?? "" } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.error ?? "Erro ao enviar.");
        if (json.pending_migration) setPendingMigration(true);
        if (json.pending_migration_040) setPending040(true);
        return;
      }
      const msg: ChatMessage = json.message;
      setDraft("");
      setPendingFile(null);
      setUrgentOpen(false);
      setUrgentReason("");
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

  function confirmUrgent() {
    const reason = urgentReason.trim();
    if (reason.length < 5) return;
    send({ urgent: true, reason });
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
  const unreadOf = useCallback(
    (id: string): number => chat?.unreadFrom[id] ?? 0,
    [chat?.unreadFrom]
  );

  const foraExpediente = foraDoExpediente();

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
          const aOn = chat?.onlineMap[a.id] ? 0 : 1;
          const bOn = chat?.onlineMap[b.id] ? 0 : 1;
          if (aOn !== bOn) return aOn - bOn;
          return a.full_name.localeCompare(b.full_name, "pt-BR");
        }),
        online: members.filter(m => chat?.onlineMap[m.id]).length,
      }));
  }, [directory, me?.id, search, chat?.onlineMap]);

  function toggleSector(sector: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }

  async function copyExt(ext: string) {
    try {
      await navigator.clipboard.writeText(ext);
      setCopiedExt(true);
      setTimeout(() => setCopiedExt(false), 1500);
    } catch { /* clipboard indisponível */ }
  }

  const selectedStatus = selected ? statusOf(selected.id) : null;
  const recipientOcupado = selectedStatus === "ocupado";
  const selectedForaExpediente = !!selected && !selectedStatus && foraExpediente;
  const counterpartTyping = !!(selected && chat?.typingFrom[selected.id]);
  const offlineLabel = foraExpediente ? "Fora do expediente" : "Offline";

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
      {!pendingMigration && pending040 && (
        <div className="flex items-center gap-2 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          Execute a migração 040 no Supabase para ativar anexos e chamadas urgentes.
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
                      const unread = unreadOf(person.id);
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
                              title={status ? STATUS_META[status].label : offlineLabel}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{person.full_name}</p>
                            {conv?.last_message ? (
                              <p className="text-xs text-gray-400 truncate">
                                {conv.last_message.sender_id === me?.id ? "Você: " : ""}
                                {conv.last_message.content ||
                                  (conv.last_message.attachment_name ? `📎 ${conv.last_message.attachment_name}` : "")}
                              </p>
                            ) : !status && foraExpediente ? (
                              <p className="text-xs text-gray-400 truncate">Fora do expediente</p>
                            ) : null}
                          </div>
                          {unread > 0 && (
                            <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
                              {unread > 99 ? "99+" : unread}
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
          {/* Aviso LGPD (dispensável) */}
          {lgpdVisible && (
            <div className="flex items-start gap-2 px-3 py-2 border-b bg-amber-50 text-amber-800 text-xs">
              <ShieldAlert size={15} className="shrink-0 mt-0.5" />
              <p className="flex-1">
                ⚠️ Não compartilhe dados identificáveis de pacientes pelo chat. Use os
                sistemas oficiais de prontuário.
              </p>
              <button
                type="button"
                onClick={dismissLgpd}
                className="p-0.5 rounded hover:bg-amber-100 text-amber-700"
                aria-label="Dispensar aviso"
              >
                <X size={14} />
              </button>
            </div>
          )}

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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{selected.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {counterpartTyping ? (
                      <span className="text-primary font-medium">digitando...</span>
                    ) : (
                      <>
                        {selected.sector || "Sem setor"} ·{" "}
                        {selectedStatus ? STATUS_META[selectedStatus].label : offlineLabel}
                      </>
                    )}
                  </p>
                </div>
                {/* Ramal do interlocutor */}
                {selected.phone_ext && (
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`tel:${selected.phone_ext}`}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary px-1.5 py-1 rounded hover:bg-gray-100"
                      title="Ligar para o ramal"
                    >
                      <Phone size={13} />
                      Ramal {selected.phone_ext}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyExt(selected.phone_ext!)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="Copiar ramal"
                      aria-label="Copiar ramal"
                    >
                      {copiedExt ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    </button>
                  </div>
                )}
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
                            className={`max-w-[85%] md:max-w-[65%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-white border rounded-bl-sm text-gray-800"
                            } ${msg.urgent ? "border-2 border-red-500" : ""}`}
                          >
                            {msg.urgent && (
                              <span className="inline-flex items-center gap-1 mb-1 rounded bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 tracking-wide">
                                <AlertTriangle size={9} />
                                URGENTE
                              </span>
                            )}
                            {msg.attachment_path && (
                              isImageName(msg.attachment_name) ? (
                                <a
                                  href={`/api/chat-interno/anexos/${msg.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block mb-1"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/chat-interno/anexos/${msg.id}`}
                                    alt={msg.attachment_name ?? "Imagem"}
                                    className="max-w-full max-h-56 rounded-lg"
                                    loading="lazy"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={`/api/chat-interno/anexos/${msg.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 border ${
                                    mine
                                      ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                                  }`}
                                >
                                  <FileText size={18} className="shrink-0" />
                                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                    {msg.attachment_name}
                                  </span>
                                  <span className={`text-[10px] shrink-0 ${mine ? "text-primary-foreground/60" : "text-gray-400"}`}>
                                    {formatBytes(msg.attachment_size)}
                                  </span>
                                </a>
                              )
                            )}
                            {msg.content}
                            {msg.urgent && msg.urgent_reason && (
                              <span className={`block text-[11px] italic mt-0.5 ${
                                mine ? "text-primary-foreground/70" : "text-gray-500"
                              }`}>
                                Motivo: {msg.urgent_reason}
                              </span>
                            )}
                            <span
                              className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${
                                mine ? "text-primary-foreground/60" : "text-gray-400"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                              {mine && (
                                msg.read_at ? (
                                  <CheckCheck size={13} className="text-sky-300" aria-label="Lida" />
                                ) : (
                                  <Check size={13} aria-label="Enviada" />
                                )
                              )}
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-red-600 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${STATUS_META.ocupado.dot}`} />
                      {selected.full_name.split(" ")[0]} está ocupado(a) e não pode ser chamado(a) agora.
                    </p>
                    <button
                      type="button"
                      onClick={() => setUrgentOpen(true)}
                      disabled={sending || (!draft.trim() && !pendingFile)}
                      className="flex items-center gap-1 text-xs font-medium text-red-600 border border-red-300 rounded-md px-2 py-1 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!draft.trim() && !pendingFile ? "Digite a mensagem antes de chamar" : undefined}
                    >
                      <AlertTriangle size={13} />
                      Chamar mesmo assim (urgente)
                    </button>
                  </div>
                )}
                {selectedForaExpediente && (
                  <p className="text-xs text-gray-400">
                    Fora do horário de expediente — a mensagem será entregue quando a pessoa
                    acessar a intranet.
                  </p>
                )}
                {sendError && <p className="text-xs text-red-600">{sendError}</p>}
                {pendingFile && (
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600">
                    <Paperclip size={13} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                    <span className="text-gray-400 shrink-0">{formatBytes(pendingFile.size)}</span>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
                      aria-label="Remover anexo"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={onFileSelected}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || pending040}
                    aria-label="Anexar arquivo"
                    title={pending040 ? "Execute a migração 040 para ativar anexos" : "Anexar arquivo (PDF ou imagem, até 10MB)"}
                  >
                    <Paperclip size={16} />
                  </Button>
                  <Input
                    value={draft}
                    onChange={e => {
                      setDraft(e.target.value);
                      notifyTyping();
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!recipientOcupado) send();
                      }
                    }}
                    maxLength={2000}
                    placeholder={recipientOcupado ? "Usuário ocupado — apenas chamada urgente..." : "Digite uma mensagem..."}
                    disabled={sending}
                  />
                  <Button
                    onClick={() => send()}
                    disabled={recipientOcupado || sending || (!draft.trim() && !pendingFile)}
                    size="icon"
                    aria-label="Enviar"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400">Mensagens são retidas por 30 dias.</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Diálogo de chamada urgente ── */}
      {urgentOpen && selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !sending && setUrgentOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-sm p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-800">Chamada urgente</h2>
            </div>
            <p className="text-xs text-gray-500">
              {selected.full_name.split(" ")[0]} está com status ocupado. A mensagem será
              entregue com destaque de urgência e o motivo ficará registrado.
            </p>
            <div className="space-y-1">
              <label htmlFor="urgent-reason" className="text-xs font-medium text-gray-600">
                Motivo da urgência (mínimo 5 caracteres)
              </label>
              <Input
                id="urgent-reason"
                value={urgentReason}
                onChange={e => setUrgentReason(e.target.value)}
                maxLength={300}
                placeholder="Ex.: paciente aguardando liberação..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUrgentOpen(false)}
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmUrgent}
                disabled={sending || urgentReason.trim().length < 5}
              >
                {sending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                Enviar urgente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
