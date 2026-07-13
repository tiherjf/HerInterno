-- Migração 044 — Detalhes adicionais de procedimentos/exames
-- Adiciona campos de convênios, pagamento (parcelas/pacotes), preparo
-- (jejum, agendamento, duração, documentos, suspensão de medicação) e
-- lista estruturada de médicos. Complementa a migração 043 (preço/categoria).
-- Aplique manualmente no Supabase antes de rodar o script de backfill.

ALTER TABLE public.procedimentos
  ADD COLUMN IF NOT EXISTS convenios TEXT[],
  ADD COLUMN IF NOT EXISTS atende_particular BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS parcelas_max INTEGER,
  ADD COLUMN IF NOT EXISTS pacote_sessoes INTEGER,
  ADD COLUMN IF NOT EXISTS pacote_preco NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS jejum_horas INTEGER,
  ADD COLUMN IF NOT EXISTS requer_agendamento BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duracao_min INTEGER,
  ADD COLUMN IF NOT EXISTS documentos_necessarios TEXT,
  ADD COLUMN IF NOT EXISTS suspende_medicacao TEXT,
  ADD COLUMN IF NOT EXISTS medicos TEXT[];
