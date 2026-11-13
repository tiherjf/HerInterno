"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarBytes } from "@/lib/chat-interno/formato";
import { DialogoUrgente } from "./DialogoUrgente";
import { STATUS_META } from "./Avatar";

const MAX_ARQUIVO = 10 * 1024 * 1024;
const TIPOS_ARQUIVO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_TEXTO = 2000;

export interface Envio {
  texto: string;
  arquivo: File | null;
  motivoUrgente?: string;
}

/**
 * Campo de digitação. O rascunho mora aqui (e não na tela inteira) para que
 * digitar não redesenhe as listas e as mensagens.
 * `onEnviar` devolve a mensagem de erro, ou null quando enviou.
 */
export function CampoMensagem({ primeiroNome, ocupado, foraExpediente, pending040, onEnviar, onDigitando }: {
  primeiroNome: string;
  ocupado: boolean;
  foraExpediente: boolean;
  pending040: boolean;
  onEnviar: (envio: Envio) => Promise<string | null>;
  onDigitando: () => void;
}) {
  const [rascunho, setRascunho] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [urgenteAberto, setUrgenteAberto] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const temConteudo = !!rascunho.trim() || !!arquivo;

  function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!f) return;
    if (!TIPOS_ARQUIVO.includes(f.type)) { setErro("Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WEBP."); return; }
    if (f.size > MAX_ARQUIVO) { setErro("Arquivo excede o limite de 10MB."); return; }
    setErro("");
    setArquivo(f);
  }

  async function enviar(motivoUrgente?: string) {
    if (!temConteudo || enviando) return;
    setEnviando(true);
    setErro("");
    const falha = await onEnviar({ texto: rascunho.trim(), arquivo, motivoUrgente });
    setEnviando(false);
    if (falha) { setErro(falha); return; }
    setRascunho("");
    setArquivo(null);
    setUrgenteAberto(false);
  }

  return (
    <div className="space-y-1.5 border-t border-border p-3">
      {ocupado && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <span className={`h-2 w-2 rounded-full ${STATUS_META.ocupado.dot}`} />
            {primeiroNome} está ocupado(a) e não pode ser chamado(a) agora.
          </p>
          <button
            type="button"
            onClick={() => setUrgenteAberto(true)}
            disabled={enviando || !temConteudo}
            className="flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={!temConteudo ? "Digite a mensagem antes de chamar" : undefined}
          >
            <AlertTriangle size={13} /> Chamar mesmo assim (urgente)
          </button>
        </div>
      )}
      {foraExpediente && (
        <p className="text-xs text-slate-400">
          Fora do horário de expediente — a mensagem será entregue quando a pessoa acessar a intranet.
        </p>
      )}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {arquivo && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          <Paperclip size={13} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
          <span className="shrink-0 text-slate-400">{formatarBytes(arquivo.size)}</span>
          <button type="button" onClick={() => setArquivo(null)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200" aria-label="Remover anexo">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputArquivo}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={escolherArquivo}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => inputArquivo.current?.click()}
          disabled={enviando || pending040}
          aria-label="Anexar arquivo"
          title={pending040 ? "Execute a migração 040 para ativar anexos" : "Anexar arquivo (PDF ou imagem, até 10MB)"}
        >
          <Paperclip size={16} />
        </Button>
        <Input
          value={rascunho}
          onChange={(e) => { setRascunho(e.target.value); onDigitando(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!ocupado) enviar();
            }
          }}
          maxLength={MAX_TEXTO}
          placeholder={ocupado ? "Usuário ocupado — apenas chamada urgente..." : "Digite uma mensagem..."}
          disabled={enviando}
          aria-label="Mensagem"
        />
        <Button onClick={() => enviar()} disabled={ocupado || enviando || !temConteudo} size="icon" aria-label="Enviar">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
      <p className="text-[10px] text-slate-400">Mensagens são retidas por 30 dias.</p>

      <DialogoUrgente
        aberto={urgenteAberto}
        primeiroNome={primeiroNome}
        enviando={enviando}
        onCancelar={() => setUrgenteAberto(false)}
        onConfirmar={(motivo) => enviar(motivo)}
      />
    </div>
  );
}
