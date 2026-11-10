"use client";

import { useSyncExternalStore } from "react";

interface NotificacaoDotProps {
  corner?: boolean; // true = absolute corner (header), false = ml-auto (sidebar)
}

// Store compartilhado: Header e Sidebar exibem o mesmo contador, então uma única
// busca a cada 60s atende os dois (antes cada instância tinha seu próprio poller).
// Não consulta com a aba em segundo plano; ao voltar, atualiza na hora.
const POLL_MS = 60_000;
let count = 0;
let lastFetch = 0;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

async function fetchUnread() {
  if (document.visibilityState === "hidden") return;
  lastFetch = Date.now();
  try {
    const res = await fetch("/api/noticias/unread", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const next = data.count ?? 0;
    if (next !== count) {
      count = next;
      listeners.forEach((l) => l());
    }
  } catch {}
}

/** Atualiza o contador na hora — chamar após marcar uma notícia como lida. */
export function refreshNoticiasUnread() {
  if (listeners.size > 0) fetchUnread();
}

function onVisible() {
  if (document.visibilityState === "visible" && Date.now() - lastFetch >= POLL_MS) {
    fetchUnread();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (Date.now() - lastFetch >= POLL_MS) fetchUnread();
    interval = setInterval(fetchUnread, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (interval) clearInterval(interval);
      interval = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export function NotificacaoDot({ corner = false }: NotificacaoDotProps) {
  const unread = useSyncExternalStore(subscribe, () => count, () => 0);

  if (unread === 0) return null;

  if (corner) {
    return (
      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none pointer-events-none">
        {unread > 99 ? "99+" : unread}
      </span>
    );
  }

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
