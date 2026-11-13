"use client";

import { memo } from "react";
import { AlertTriangle, Check, CheckCheck, FileText } from "lucide-react";
import type { Mensagem } from "@/lib/chat-interno/tipos";
import { chaveDia, ehImagem, formatarBytes, formatarDia, formatarHora } from "@/lib/chat-interno/formato";

/** Balões da conversa, com separador de dia, anexo, selo de urgente e ✓/✓✓. */
export const ListaMensagens = memo(function ListaMensagens({ mensagens, meuId }: {
  mensagens: Mensagem[];
  meuId: string;
}) {
  const agora = new Date();
  return (
    <>
      {mensagens.map((m, i) => {
        const minha = m.sender_id === meuId;
        const novoDia = i === 0 || chaveDia(m.created_at) !== chaveDia(mensagens[i - 1].created_at);
        const anexo = `/api/chat-interno/anexos/${m.id}`;
        return (
          <div key={m.id}>
            {novoDia && (
              <div className="flex justify-center py-2">
                <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                  {formatarDia(m.created_at, agora)}
                </span>
              </div>
            )}
            <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm md:max-w-[65%] ${
                  minha
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-white text-slate-800"
                } ${m.urgent ? "border-2 border-red-500" : ""}`}
              >
                {m.urgent && (
                  <span className="mb-1 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                    <AlertTriangle size={9} />
                    URGENTE
                  </span>
                )}
                {m.attachment_path && (
                  ehImagem(m.attachment_name) ? (
                    <a href={anexo} target="_blank" rel="noreferrer" className="mb-1 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={anexo} alt={m.attachment_name ?? "Imagem"} className="max-h-56 max-w-full rounded-lg" loading="lazy" />
                    </a>
                  ) : (
                    <a
                      href={anexo}
                      target="_blank"
                      rel="noreferrer"
                      className={`mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                        minha
                          ? "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20"
                          : "border-border bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <FileText size={18} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{m.attachment_name}</span>
                      <span className={`shrink-0 text-[10px] ${minha ? "text-primary-foreground/60" : "text-slate-400"}`}>
                        {formatarBytes(m.attachment_size)}
                      </span>
                    </a>
                  )
                )}
                {m.content}
                {m.urgent && m.urgent_reason && (
                  <span className={`mt-0.5 block text-[11px] italic ${minha ? "text-primary-foreground/70" : "text-slate-500"}`}>
                    Motivo: {m.urgent_reason}
                  </span>
                )}
                <span
                  className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                    minha ? "text-primary-foreground/60" : "text-slate-400"
                  }`}
                >
                  {formatarHora(m.created_at)}
                  {minha && (m.read_at
                    ? <CheckCheck size={13} className="text-sky-300" aria-label="Lida" />
                    : <Check size={13} aria-label="Enviada" />)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
});
