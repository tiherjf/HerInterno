"use client";

import { useEffect } from "react";
import { refreshNoticiasUnread } from "@/components/news/NotificacaoDot";

export function MarcarLida({ newsId }: { newsId: string }) {
  useEffect(() => {
    fetch(`/api/noticias/${newsId}/lida`, { method: "POST" })
      .then(refreshNoticiasUnread)
      .catch(() => {});
  }, [newsId]);

  return null;
}
