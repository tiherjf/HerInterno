-- ─────────────────────────────────────────────────────────────
-- MKT: campos adicionais em tickets e ticket_categories
-- Baseado em POL HER 003 – Política de Comunicação
-- ─────────────────────────────────────────────────────────────

-- Expande check constraint de team para incluir marketing
ALTER TABLE public.ticket_categories
  DROP CONSTRAINT IF EXISTS ticket_categories_team_check;

ALTER TABLE public.ticket_categories
  ADD CONSTRAINT ticket_categories_team_check
  CHECK (team IN ('ti', 'manutencao', 'marketing'));

-- Campos MKT na tabela tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS mkt_protocolo      TEXT,
  ADD COLUMN IF NOT EXISTS mkt_is_alteracao   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mkt_prazo_desejado DATE;

-- Índice único no protocolo COM (só quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS tickets_mkt_protocolo_idx
  ON public.tickets (mkt_protocolo)
  WHERE mkt_protocolo IS NOT NULL;

-- SLA de alteração por categoria
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS alteracao_sla_hours INT;

-- Constraint única para inserção segura por nome+equipe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ticket_categories_name_team_uq'
  ) THEN
    ALTER TABLE public.ticket_categories
      ADD CONSTRAINT ticket_categories_name_team_uq UNIQUE (name, team);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Categorias MKT (POL HER 003 – SLAs em horas úteis)
--   sla_hours           = tempo para nova criação
--   alteracao_sla_hours = tempo para alteração de material existente
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.ticket_categories
  (name, color, team, sla_hours, alteracao_sla_hours, default_priority, active)
VALUES
  ('Comunicado Simples',                          '#6366f1', 'marketing',   8,   2,   'medium', true),
  ('Arte Simples (Banner, Card, Infográfico)',     '#ec4899', 'marketing',  24,   6,   'medium', true),
  ('Folder / Panfleto / Informativo / Release',   '#f59e0b', 'marketing',  40,  16,   'low',    true),
  ('Manual / Apresentação Especial',              '#8b5cf6', 'marketing',  56,  16,   'low',    true),
  ('Vídeo / E-mail / Carta Convite',              '#06b6d4', 'marketing',  80,  24,   'medium', true),
  ('Ação / Campanha Interna',                     '#10b981', 'marketing',  80, NULL,  'medium', true),
  ('Evento',                                      '#f97316', 'marketing', 160, NULL,  'low',    true)
ON CONFLICT (name, team) DO UPDATE SET
  color                = EXCLUDED.color,
  sla_hours            = EXCLUDED.sla_hours,
  alteracao_sla_hours  = EXCLUDED.alteracao_sla_hours,
  default_priority     = EXCLUDED.default_priority,
  active               = EXCLUDED.active;
