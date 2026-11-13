"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MessageCircle, ShieldAlert, X } from "lucide-react";
import { Cabecalho } from "@/components/ui-her/Cabecalho";
import { useChatContext } from "@/components/chat/ChatProvider";
import type { Conversa, Mensagem, Pessoa, Status } from "@/lib/chat-interno/tipos";
import { alvoDoLink } from "@/lib/chat-interno/conversas";
import { foraDoExpediente } from "@/lib/chat-interno/formato";
import { ColunaEsquerda } from "./ColunaEsquerda";
import { PainelConversa, type AvisosMigracao } from "./PainelConversa";
import { SeletorStatus } from "./SeletorStatus";

const CHAVE_LGPD = "chat-lgpd-aviso-v1";
const INTERVALO_POLLING = 30_000;

/** Tela do chat: lista à esquerda, conversa à direita (no celular, uma de cada vez). */
export default function ChatTela({ initialCom }: { initialCom: string | string[] | undefined }) {
  const chat = useChatContext();
  const [me, setMe] = useState<Pessoa | null>(null);
  const [diretorio, setDiretorio] = useState<Pessoa[]>([]);
  const [conversas, setConversas] = useState<Record<string, Conversa>>({});
  const [carregando, setCarregando] = useState(true);
  const [pending039, setPending039] = useState(false);
  const [pending040, setPending040] = useState(false);
  const [selecionado, setSelecionado] = useState<Pessoa | null>(null);
  const [lgpdVisivel, setLgpdVisivel] = useState(false);
  const linkAplicado = useRef(false);
  const selecionadoRef = useRef<string | null>(null);
  selecionadoRef.current = selecionado?.id ?? null;

  const syncUnread = chat?.syncUnread;
  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-interno");
      const json = await res.json();
      if (!res.ok) return;
      setMe(json.me ?? null);
      setDiretorio(json.directory ?? []);
      setPending039(!!json.pending_migration);
      const mapa: Record<string, Conversa> = {};
      const contagem: Record<string, number> = {};
      for (const c of (json.conversations ?? []) as Conversa[]) {
        // A conversa aberta já foi lida aqui
        mapa[c.with] = c.with === selecionadoRef.current ? { ...c, unread: 0, urgente: false } : c;
        if (c.unread > 0) contagem[c.with] = c.unread;
      }
      setConversas((prev) => ({ ...prev, ...mapa }));
      syncUnread?.(contagem);
    } catch { /* rede indisponível — mantém o que tem */ }
    finally { setCarregando(false); }
  }, [syncUnread]);

  useEffect(() => {
    carregar();
    try { setLgpdVisivel(localStorage.getItem(CHAVE_LGPD) !== "1"); } catch { setLgpdVisivel(true); }
  }, [carregar]);

  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== "undefined" && !document.hasFocus()) return;
      carregar();
    }, INTERVALO_POLLING);
    return () => clearInterval(t);
  }, [carregar]);

  // Mensagem nova atualiza a lista de conversas
  const assinarMensagens = chat?.subscribeMessages;
  useEffect(() => {
    if (!assinarMensagens) return;
    return assinarMensagens((m) => {
      const aberta = selecionadoRef.current === m.sender_id;
      setConversas((prev) => {
        const antes = prev[m.sender_id];
        return {
          ...prev,
          [m.sender_id]: {
            with: m.sender_id,
            last_message: m,
            unread: 0, // o contador exibido vem do provider
            urgente: !aberta && ((antes?.urgente ?? false) || m.urgent === true),
          },
        };
      });
    });
  }, [assinarMensagens]);

  const abrir = useCallback((p: Pessoa) => {
    setSelecionado(p);
    setConversas((prev) => (prev[p.id]?.urgente ? { ...prev, [p.id]: { ...prev[p.id], urgente: false } } : prev));
  }, []);

  // Link direto ?com=<id>: abre uma vez, quando o diretório chega
  useEffect(() => {
    if (carregando || linkAplicado.current || !me) return;
    linkAplicado.current = true;
    const alvo = alvoDoLink(initialCom, diretorio, me.id);
    if (alvo) abrir(alvo);
  }, [carregando, me, diretorio, initialCom, abrir]);

  const onEnviada = useCallback((m: Mensagem) => {
    setConversas((prev) => ({
      ...prev,
      [m.recipient_id]: { with: m.recipient_id, last_message: m, unread: 0, urgente: false },
    }));
  }, []);

  const onMigracao = useCallback((a: AvisosMigracao) => {
    if (a.pending_migration) setPending039(true);
    if (a.pending_migration_040) setPending040(true);
  }, []);

  function dispensarLgpd() {
    setLgpdVisivel(false);
    try { localStorage.setItem(CHAVE_LGPD, "1"); } catch { /* armazenamento indisponível */ }
  }

  const onlineMap = chat?.onlineMap;
  const statusDe = useCallback((id: string): Status | null => onlineMap?.[id]?.status ?? null, [onlineMap]);
  const online = useCallback((id: string) => !!onlineMap?.[id], [onlineMap]);
  const unreadFrom = chat?.unreadFrom;
  const naoLidas = useCallback((id: string) => unreadFrom?.[id] ?? 0, [unreadFrom]);

  const listaConversas = useMemo(() => Object.values(conversas), [conversas]);
  const fora = foraDoExpediente(new Date());
  const offlineLabel = fora ? "Fora do expediente" : "Offline";
  const meuStatus: Status = chat?.myStatus ?? "disponivel";

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[460px] flex-col gap-4 md:h-[calc(100dvh-7.5rem)]">
      <Cabecalho
        titulo="Chat"
        subtitulo="Conversas com colegas de todos os setores"
        acoes={<SeletorStatus status={meuStatus} onMudar={(s) => chat?.setMyStatus(s)} />}
      />

      {pending039 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" /> Execute a migração 039 no Supabase para ativar o chat.
        </p>
      )}
      {!pending039 && pending040 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" /> Execute a migração 040 no Supabase para ativar anexos e chamadas urgentes.
        </p>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-white">
        <div className={`${selecionado ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border md:w-80 lg:w-96`}>
          <ColunaEsquerda
            carregando={carregando}
            conversas={listaConversas}
            diretorio={diretorio}
            meuId={me?.id ?? ""}
            selecionado={selecionado?.id}
            statusDe={statusDe}
            online={online}
            naoLidas={naoLidas}
            totalNaoLidas={chat?.totalUnread ?? 0}
            foraExpediente={fora}
            offlineLabel={offlineLabel}
            onAbrir={abrir}
          />
        </div>

        <div className={`${selecionado ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {lgpdVisivel && (
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              <p className="flex-1">
                Não compartilhe dados identificáveis de pacientes pelo chat. Use os sistemas oficiais de prontuário.
              </p>
              <button type="button" onClick={dispensarLgpd} className="rounded p-0.5 text-amber-700 hover:bg-amber-100" aria-label="Dispensar aviso">
                <X size={14} />
              </button>
            </div>
          )}
          {selecionado && me ? (
            <PainelConversa
              key={selecionado.id}
              pessoa={selecionado}
              meuId={me.id}
              status={statusDe(selecionado.id)}
              offlineLabel={offlineLabel}
              foraExpediente={fora}
              pending040={pending040}
              onVoltar={() => setSelecionado(null)}
              onEnviada={onEnviada}
              onMigracao={onMigracao}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-slate-400">
              <MessageCircle size={44} className="mb-3 opacity-25" />
              <p className="text-sm">Escolha uma conversa ou uma pessoa para começar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
