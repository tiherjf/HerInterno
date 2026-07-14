"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Ticket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────

interface TicketAction {
  type: "create_ticket";
  team: "ti" | "manutencao" | "marketing";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  location?: string;
}

type ActionState = "pending" | "submitting" | "done" | "cancelled" | "error";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: TicketAction;
  actionState?: ActionState;
  actionError?: string;
  ticketNumber?: number | null;
  ticketProtocolo?: string | null;
}

const TEAM_LABELS: Record<TicketAction["team"], string> = {
  ti: "TI",
  manutencao: "Manutenção",
  marketing: "Marketing",
};

const PRIORITY_LABELS: Record<TicketAction["priority"], string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const SUGGESTIONS = [
  "Abrir chamado de TI",
  "Qual o ramal da recepção?",
  "Como justificar um ponto?",
  "Onde encontro os POPs da Qualidade?",
];

const STREAM_TIMEOUT_MS = 30000;

// ─── Bloco de ação (```action ... ```) ────────────────────────────────────

const ACTION_BLOCK_REGEX = /```action\s*([\s\S]*?)```/;

// Remove o bloco de ação (completo ou parcial, durante o streaming) do texto exibido
function stripActionBlock(content: string): string {
  const idx = content.indexOf("```action");
  if (idx !== -1) {
    const complete = content.match(ACTION_BLOCK_REGEX);
    if (complete) {
      return (content.slice(0, idx) + content.slice(idx + complete[0].length)).trim();
    }
    return content.slice(0, idx).trimEnd();
  }
  // Esconde cerca parcial no fim do texto enquanto o streaming chega ("``", "```ac"...)
  return content.replace(/\n?`{1,3}(?:a(?:c(?:t(?:i(?:o(?:n)?)?)?)?)?)?$/, "").trimEnd();
}

function parseTicketAction(content: string): TicketAction | null {
  const match = content.match(ACTION_BLOCK_REGEX);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[1].trim());
    if (
      obj?.type === "create_ticket" &&
      typeof obj.title === "string" &&
      obj.title.trim() &&
      typeof obj.description === "string" &&
      obj.description.trim() &&
      ["ti", "manutencao", "marketing"].includes(obj.team)
    ) {
      return {
        type: "create_ticket",
        team: obj.team,
        title: obj.title.trim(),
        description: obj.description.trim(),
        priority: ["low", "medium", "high"].includes(obj.priority) ? obj.priority : "medium",
        location: typeof obj.location === "string" && obj.location.trim() ? obj.location.trim() : undefined,
      };
    }
  } catch {
    // JSON inválido: ignora o bloco
  }
  return null;
}

// ─── Renderizador de Markdown mínimo e seguro (sem HTML bruto) ────────────

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]*\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="bg-gray-100 rounded px-1 py-0.5 text-[0.85em] font-mono">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(tok);
      }
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function MarkdownContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let codeLines: string[] | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const k = `p-${key++}`;
    blocks.push(
      <p key={k}>
        {paragraph.map((line, idx) => (
          <span key={`${k}-${idx}`}>
            {idx > 0 && <br />}
            {renderInline(line, `${k}-${idx}`)}
          </span>
        ))}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const k = `l-${key++}`;
    const items = list.items.map((item, idx) => (
      <li key={`${k}-${idx}`}>{renderInline(item, `${k}-${idx}`)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={k} className="list-decimal pl-5 space-y-0.5">{items}</ol>
      ) : (
        <ul key={k} className="list-disc pl-5 space-y-0.5">{items}</ul>
      )
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (codeLines !== null) {
      if (line.trim().startsWith("```")) {
        blocks.push(
          <pre key={`c-${key++}`} className="bg-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = null;
      } else {
        codeLines.push(rawLine);
      }
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      codeLines = [];
      continue;
    }

    const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const headingMatch = line.match(/^#{1,4}\s+(.*)$/);

    if (ulMatch || olMatch) {
      flushParagraph();
      const ordered = Boolean(olMatch);
      const item = (ulMatch?.[1] ?? olMatch?.[1] ?? "").trim();
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item);
    } else if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={`h-${key++}`} className="font-semibold">
          {renderInline(headingMatch[1], `h-${key}`)}
        </p>
      );
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  if (codeLines !== null) {
    blocks.push(
      <pre key={`c-${key++}`} className="bg-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono">
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2 [overflow-wrap:anywhere]">{blocks}</div>;
}

// ─── Página ───────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Sou o assistente virtual do Hospital Evandro Ribeiro. Posso ajudá-lo com:\n\n- Consulta de ramais\n- Dúvidas de RH (férias, ponto, benefícios)\n- Suporte de TI\n- Abertura de chamados internos (TI, manutenção e marketing)\n- Documentos da Base de Documentos e da Qualidade\n\nComo posso ajudá-lo hoje?",
};

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function sendMessage(text?: string) {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput("");
    setLoading(true);

    const placeholderId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: "assistant", content: "" },
    ]);

    // Timeout de 30s sem resposta/atividade para a UI nunca ficar travada
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        let serverError = "";
        try {
          const json = await response.json();
          serverError = json.error || "";
        } catch {
          // Corpo não é JSON
        }
        throw new Error(serverError || "Erro na resposta do servidor");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimer();

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              accumulated += delta;
              updateMessage(placeholderId, { content: accumulated });
            } catch {
              // Ignorar linhas inválidas
            }
          }
        }
      }

      // Fim do stream: detectar bloco de ação e exibir cartão de confirmação
      const action = parseTicketAction(accumulated);
      const visibleContent = stripActionBlock(accumulated);
      updateMessage(placeholderId, {
        content:
          visibleContent ||
          (action
            ? "Preparei o chamado abaixo para você confirmar."
            : "Não recebi resposta do assistente. Tente novamente."),
        ...(action ? { action, actionState: "pending" as ActionState } : {}),
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      const serverMessage = err instanceof Error && err.message !== "Erro na resposta do servidor" ? err.message : "";
      updateMessage(placeholderId, {
        content: aborted
          ? "O assistente demorou muito para responder (tempo limite de 30s). Tente novamente em instantes."
          : serverMessage ||
            "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  async function confirmTicket(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    const action = msg?.action;
    if (!action || msg?.actionState === "submitting" || msg?.actionState === "done") return;

    updateMessage(messageId, { actionState: "submitting", actionError: undefined });

    try {
      const res = await fetch("/api/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          description: `${action.description}\n\n(Chamado aberto via Assistente IA)`,
          team: action.team,
          priority: action.priority,
          location: action.team === "manutencao" ? action.location : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao abrir o chamado");
      }
      updateMessage(messageId, {
        actionState: "done",
        ticketNumber: json.number ?? null,
        ticketProtocolo: json.mkt_protocolo ?? null,
      });
    } catch (err) {
      updateMessage(messageId, {
        actionState: "error",
        actionError:
          err instanceof Error ? err.message : "Erro ao abrir o chamado. Tente novamente.",
      });
    }
  }

  function cancelTicket(messageId: string) {
    updateMessage(messageId, { actionState: "cancelled" });
  }

  function clearChat() {
    setMessages([WELCOME_MESSAGE]);
  }

  function renderActionCard(msg: Message) {
    const action = msg.action;
    if (!action) return null;

    if (msg.actionState === "cancelled") {
      return (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-gray-50">
          <XCircle size={14} /> Abertura de chamado cancelada.
        </div>
      );
    }

    if (msg.actionState === "done") {
      return (
        <div className="mt-2 flex items-start gap-2 text-sm border border-green-200 rounded-lg px-3 py-2.5 bg-green-50 text-green-800">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              Chamado {msg.ticketProtocolo ? msg.ticketProtocolo : `#${msg.ticketNumber ?? "—"}`} aberto com sucesso!
            </p>
            <p className="text-xs mt-0.5">
              Acompanhe o andamento na página Meus Chamados.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 border rounded-lg p-3 bg-gray-50 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Ticket size={15} className="text-primary shrink-0" />
          Abrir chamado: {action.title}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Equipe: {TEAM_LABELS[action.team]} · Prioridade: {PRIORITY_LABELS[action.priority]}</p>
          {action.location && <p>Localização: {action.location}</p>}
          <p className="line-clamp-3 whitespace-pre-wrap">{action.description}</p>
        </div>
        {msg.actionState === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle size={13} className="shrink-0" /> {msg.actionError}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => confirmTicket(msg.id)}
            disabled={msg.actionState === "submitting"}
          >
            {msg.actionState === "submitting" ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Abrindo...
              </>
            ) : msg.actionState === "error" ? (
              "Tentar novamente"
            ) : (
              "Confirmar"
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancelTicket(msg.id)}
            disabled={msg.actionState === "submitting"}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Bot className="text-primary" /> Assistente IA
          </h2>
          <p className="text-muted-foreground text-sm">
            Assistente inteligente do Hospital Evandro Ribeiro
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} title="Limpar conversa">
          <Trash2 size={16} /> Limpar
        </Button>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg) => {
          const displayContent =
            msg.role === "assistant" ? stripActionBlock(msg.content) : msg.content;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-3",
                msg.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className={cn(
                    "text-xs",
                    msg.role === "assistant"
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-700"
                  )}
                >
                  {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-white border shadow-sm"
                    : "bg-primary text-primary-foreground whitespace-pre-wrap"
                )}
              >
                {msg.role === "assistant" ? (
                  displayContent || msg.action ? (
                    <>
                      {displayContent && <MarkdownContent content={displayContent} />}
                      {renderActionCard(msg)}
                    </>
                  ) : (
                    <span className="flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                    </span>
                  )
                ) : (
                  msg.content
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões rápidas */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 pb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 hover:border-primary/40 text-gray-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Digite sua mensagem..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
