"use client";

import { useEffect } from "react";

export function MarcarLida({ newsId }: { newsId: string }) {
  useEffect(() => {
    fetch(`/api/noticias/${newsId}/lida`, { method: "POST" }).catch(() => {});
  }, [newsId]);

  return null;
}
