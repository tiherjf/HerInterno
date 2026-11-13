// Colunas e detecção de migração pendente do chat interno (rotas de API).

const MISSING_TABLE_CODES = ["PGRST205", "42P01"];

// Colunas base (migração 039) e completas (039 + 040)
export const BASE_COLUMNS = "id, sender_id, recipient_id, content, created_at, read_at";
export const FULL_COLUMNS = `${BASE_COLUMNS}, attachment_path, attachment_name, attachment_size, urgent, urgent_reason`;

// Ids são UUIDs em produção e "dev-*" em modo dev — restringe a charset seguro
// para não quebrar a sintaxe de filtros do PostgREST.
export const SAFE_ID = /^[A-Za-z0-9-]+$/;

/** Tabela chat_messages inexistente (migração 039 pendente). */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.includes(error.code)) return true;
  return /chat_messages/.test(error.message ?? "") && /não existe|does not exist|schema cache/i.test(error.message ?? "");
}

/**
 * Detecta coluna inexistente das melhorias do chat (migração 040 não aplicada).
 * Postgres: 42703 (undefined_column); PostgREST: PGRST204 (fora do schema cache).
 * Mesmo padrão de erroColunaAgenda em components/corpo-clinico/agenda.ts.
 */
export function erroColuna040(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (e.code === "42703" || e.code === "PGRST204") && /attachment|urgent/.test(msg);
}
