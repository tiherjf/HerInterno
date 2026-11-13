"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useChatContext } from "@/components/chat/ChatProvider";
import type { Mensagem, Pessoa, Status } from "@/lib/chat-interno/tipos";
import { juntarMensagens } from "@/lib/chat-interno/formato";
import { urgentePendente } from "@/lib/chat-interno/conversas";
import { CabecalhoConversa } from "./CabecalhoConversa";
import { FaixaUrgente } from "./FaixaUrgente";
import { ListaMensagens } from "./ListaMensagens";
import { CampoMensagem, type Envio } from "./CampoMensagem";

const INTERVALO_DIGITANDO = 2000;
const INTERVALO_POLLING = 30_000;

export interface AvisosMigracao {
  pending_migration?: boolean;
  pending_migration_040?: boolean;
}

/**
 * Conversa aberta com uma pessoa. Montado com `key={pessoa.id}`: trocar de
 * pessoa recomeça o estado do zero.
 */
export function PainelConversa({ pessoa, meuId, status, offlineLabel, foraExpediente, pending040, onVoltar, onEnviada, onMigracao }: {
  pessoa: Pessoa;
  meuId: string;
  status: Status | null;
  offlineLabel: string;
  foraExpediente: boolean;
  pending040: boolean;
  onVoltar: () => void;
  onEnviada: (m: Mensagem) => void;
  onMigracao: (avisos: AvisosMigracao) => void;
}) {
  const chat = useChatContext();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [urgentesFechados, setUrgentesFechados] = useState<Set<string>>(new Set());

  const fimRef = useRef<HTMLDivElement>(null);
  const pularRolagem = useRef(false);
  const canalDigitando = useRef<RealtimeChannel | null>(null);
  const canalPronto = useRef(false);
  const ultimoDigitando = useRef(0);

  const url = `/api/chat-interno/mensagens?with=${encodeURIComponent(pessoa.id)}`;
  const primeiroNome = pessoa.full_name.split(" ")[0];

  const marcarLida = useCallback(() => {
    chat?.clearUnread(pessoa.id);
    fetch("/api/chat-interno/lidas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ with: pessoa.id }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id, chat?.clearUnread]);

  // Carga inicial + conversa ativa no provider (não conta como não lida)
  const setAtiva = chat?.setActiveConversation;
  useEffect(() => {
    let cancelado = false;
    setAtiva?.(pessoa.id);
    (async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (cancelado || !res.ok) return;
        setMensagens(json.messages ?? []);
        setTemMais(!!json.has_more);
        onMigracao(json);
      } catch { /* rede indisponível — o polling tenta de novo */ }
      finally { if (!cancelado) setCarregando(false); }
    })();
    marcarLida();
    return () => {
      cancelado = true;
      setAtiva?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id]);

  async function carregarAntigas() {
    if (mensagens.length === 0 || carregandoAntigas) return;
    setCarregandoAntigas(true);
    pularRolagem.current = true;
    try {
      const res = await fetch(`${url}&before=${encodeURIComponent(mensagens[0].created_at)}`);
      const json = await res.json();
      if (res.ok) {
        setMensagens((prev) => juntarMensagens(json.messages ?? [], prev));
        setTemMais(!!json.has_more);
      }
    } catch { /* melhor esforço */ }
    finally { setCarregandoAntigas(false); }
  }

  // Mensagens novas e confirmações de leitura vindas do provider
  const assinarMensagens = chat?.subscribeMessages;
  const assinarLeituras = chat?.subscribeReads;
  useEffect(() => {
    if (!assinarMensagens || !assinarLeituras) return;
    const sairMsg = assinarMensagens((m) => {
      if (m.sender_id !== pessoa.id) return;
      setMensagens((prev) => juntarMensagens(prev, [m]));
      marcarLida();
    });
    const sairLeitura = assinarLeituras((por) => {
      if (por !== pessoa.id) return;
      const agora = new Date().toISOString();
      setMensagens((prev) => prev.map((m) => (m.sender_id === meuId && !m.read_at ? { ...m, read_at: agora } : m)));
    });
    return () => { sairMsg(); sairLeitura(); };
  }, [assinarMensagens, assinarLeituras, pessoa.id, meuId, marcarLida]);

  // Polling de segurança (janela focada)
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== "undefined" && !document.hasFocus()) return;
      fetch(url)
        .then((r) => r.json())
        .then((json) => { if (json.messages) setMensagens((prev) => juntarMensagens(prev, json.messages)); })
        .catch(() => {});
    }, INTERVALO_POLLING);
    return () => clearInterval(t);
  }, [url]);

  // Canal para avisar "digitando" (só leva quem digita)
  useEffect(() => {
    canalPronto.current = false;
    let client: SupabaseClient | null = null;
    let canal: RealtimeChannel | null = null;
    try {
      client = createClient();
      canal = client.channel(`chat:user:${pessoa.id}`);
      canal.subscribe((s) => { if (s === "SUBSCRIBED") canalPronto.current = true; });
      canalDigitando.current = canal;
    } catch { /* tempo real indisponível — sem "digitando" */ }
    return () => {
      canalPronto.current = false;
      canalDigitando.current = null;
      try { if (client && canal) client.removeChannel(canal); } catch { /* melhor esforço */ }
    };
  }, [pessoa.id]);

  const avisarDigitando = useCallback(() => {
    const agora = Date.now();
    if (agora - ultimoDigitando.current < INTERVALO_DIGITANDO) return;
    if (!canalPronto.current || !canalDigitando.current) return;
    ultimoDigitando.current = agora;
    try {
      canalDigitando.current.send({ type: "broadcast", event: "typing", payload: { from: meuId } });
    } catch { /* melhor esforço */ }
  }, [meuId]);

  // Rola para o fim a cada mensagem (exceto ao carregar antigas)
  useEffect(() => {
    if (pularRolagem.current) { pularRolagem.current = false; return; }
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  async function enviar({ texto, arquivo, motivoUrgente }: Envio): Promise<string | null> {
    try {
      let anexo: { attachment_path: string; attachment_name: string; attachment_size: number } | null = null;
      if (arquivo) {
        const form = new FormData();
        form.append("file", arquivo);
        const up = await fetch("/api/chat-interno/anexos", { method: "POST", body: form });
        const upJson = await up.json();
        if (!up.ok) return upJson.error ?? "Erro ao enviar anexo.";
        anexo = { attachment_path: upJson.path, attachment_name: arquivo.name, attachment_size: arquivo.size };
      }
      const res = await fetch("/api/chat-interno/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: pessoa.id,
          content: texto,
          ...(anexo ?? {}),
          ...(motivoUrgente ? { urgent: true, urgent_reason: motivoUrgente } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onMigracao(json);
        return json.error ?? "Erro ao enviar.";
      }
      const m: Mensagem = json.message;
      setMensagens((prev) => juntarMensagens(prev, [m]));
      onEnviada(m);
      return null;
    } catch {
      return "Falha de rede ao enviar.";
    }
  }

  const urgente = urgentePendente(mensagens, meuId);
  const mostrarFaixa = !!urgente && !urgentesFechados.has(urgente.id);
  const digitando = !!chat?.typingFrom[pessoa.id];

  return (
    <>
      <CabecalhoConversa pessoa={pessoa} status={status} offlineLabel={offlineLabel} digitando={digitando} onVoltar={onVoltar} />
      {mostrarFaixa && urgente && (
        <FaixaUrgente
          primeiroNome={primeiroNome}
          motivo={urgente.urgent_reason ?? ""}
          onFechar={() => setUrgentesFechados((prev) => new Set(prev).add(urgente.id))}
        />
      )}
      <div className="flex-1 space-y-1.5 overflow-y-auto bg-slate-50/60 px-3 py-3">
        {temMais && (
          <div className="flex justify-center pb-2">
            <Button variant="outline" size="sm" onClick={carregarAntigas} disabled={carregandoAntigas}>
              {carregandoAntigas && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Carregar mensagens anteriores
            </Button>
          </div>
        )}
        {carregando ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : mensagens.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Nenhuma mensagem ainda. Diga olá!</p>
        ) : (
          <ListaMensagens mensagens={mensagens} meuId={meuId} />
        )}
        <div ref={fimRef} />
      </div>
      <CampoMensagem
        primeiroNome={primeiroNome}
        ocupado={status === "ocupado"}
        foraExpediente={!status && foraExpediente}
        pending040={pending040}
        onEnviar={enviar}
        onDigitando={avisarDigitando}
      />
    </>
  );
}
