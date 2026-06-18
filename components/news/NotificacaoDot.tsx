"use client";

import { useEffect, useState } from "react";

interface NotificacaoDotProps {
  corner?: boolean; // true = absolute corner (header), false = ml-auto (sidebar)
}

export function NotificacaoDot({ corner = false }: NotificacaoDotProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/noticias/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(data.count ?? 0);
      } catch {}
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  if (corner) {
    return (
      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none pointer-events-none">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
