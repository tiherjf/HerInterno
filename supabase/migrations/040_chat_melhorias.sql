-- ─────────────────────────────────────────────────────────────
-- Migração 040 — Melhorias do Chat Interno
--
-- Adiciona suporte a:
--   • Anexos (arquivos no bucket privado "chat" do Storage):
--     attachment_path/name/size referenciam o objeto enviado.
--   • Chamada urgente: quando o destinatário está "ocupado",
--     o remetente pode furar o bloqueio informando um motivo
--     (urgent = true + urgent_reason), que fica auditado.
--   • Índice por created_at para o expurgo automático de
--     mensagens com mais de 30 dias (rota /api/chat-interno/expurgo).
--
-- Aplicar manualmente no dashboard do Supabase (SQL Editor).
-- O código degrada graciosamente enquanto esta migração não for
-- aplicada (mensagens simples continuam funcionando).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER,
  ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS urgent_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages (created_at);
