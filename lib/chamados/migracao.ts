/**
 * Detecta erros de banco causados por migrações ainda não aplicadas (041/042):
 * - Coluna inexistente (waiting_since, materials, cost, sla_breach_reason,
 *   ola_hours, default_priority...):
 *   Postgres 42703 (undefined_column) ou PostgREST PGRST204 (fora do schema cache).
 * - CHECK constraint de status sem 'waiting_user' (041) ou
 *   'waiting_third_party' (042): Postgres 23514.
 * - CHECK constraint de prioridade sem 'scheduled' (042): Postgres 23514.
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

/** Violação de CHECK constraint de prioridade (ex.: 'scheduled' antes da migração 042). */
export function erroCheckPrioridade(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return e.code === "23514" && msg.includes("priority");
}

/** Mensagem padrão para recursos que dependem da migração 042. */
export const MSG_MIGRACAO_042 =
  "Execute a migração 042 no Supabase (042_chamados_categorias_ola.sql) para habilitar este recurso.";
