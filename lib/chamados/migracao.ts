/**
 * Detecta erros de banco causados pela migração 041 ainda não aplicada:
 * - Coluna inexistente (waiting_since, materials, cost...):
 *   Postgres 42703 (undefined_column) ou PostgREST PGRST204 (fora do schema cache).
 * - CHECK constraint de status sem 'waiting_user': Postgres 23514.
 */
export function erroColunaChamados(error: unknown, colunas: string[]): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204") &&
    colunas.some(c => msg.includes(c.toLowerCase()))
  );
}

/** Violação de CHECK constraint (ex.: status 'waiting_user' antes da migração 041). */
export function erroCheckStatus(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return e.code === "23514" && msg.includes("status");
}
