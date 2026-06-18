// Wrapper que captura erros do Supabase em modo dev (sem credenciais reais)
// Em produção, os erros não são capturados e passam normalmente

import { createClient } from "./server";

type QueryResult<T> = { data: T | null; error: unknown; count?: number | null };

export function createSafeClient() {
  const client = createClient();

  // Proxy que captura erros de conexão em dev
  if (process.env.NODE_ENV !== "development") {
    return client;
  }

  return new Proxy(client, {
    get(target, prop) {
      const value = (target as unknown as Record<string | symbol, unknown>)[prop as string];
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          try {
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          } catch {
            return { data: null, error: null, count: 0 };
          }
        };
      }
      return value;
    },
  });
}
