"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Bot, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou o assistente virtual do Hospital Evandro Ribeiro. Posso ajudá-lo com:\n\n• Consulta de ramais\n• Dúvidas de RH (férias, ponto, benefícios)\n• Suporte de TI\n• Abertura de chamados no GLPI\n• Informações sobre treinamentos\n\nComo posso ajudá-lo hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Erro na resposta do servidor");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId ? { ...m, content: accumulated } : m
                )
              );
            } catch {
              // Ignorar linhas inválidas
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content:
                  "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Olá! Sou o assistente virtual do Hospital Evandro Ribeiro. Como posso ajudá-lo?",
      },
    ]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
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
        {messages.map((msg) => (
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
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
                msg.role === "assistant"
                  ? "bg-white border shadow-sm"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {msg.content || (
                <span className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

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
        <Button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
