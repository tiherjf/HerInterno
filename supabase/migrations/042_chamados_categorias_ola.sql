-- 042: Categorias com OLA e prioridade padrão + motivo de estouro de SLA
-- Aplicar no SQL Editor do Supabase Dashboard.

-- Categorias: OLA (meta interna de primeira resposta, em horas) e prioridade
-- padrão do chamado ("o tipo de chamado de acordo com a categoria"):
--   low = Baixa · medium = Média · high = Alta · critical = Urgente · scheduled = A Programar
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS ola_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS default_priority TEXT NOT NULL DEFAULT 'medium';

-- Tickets: motivo descritivo de por que o SLA estourou (preenchido ao resolver
-- um chamado fora do prazo)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sla_breach_reason TEXT;

-- ATENÇÃO (mesmo aviso da migração 041): se tickets.status tiver CHECK constraint,
-- recriá-la incluindo também 'waiting_third_party' (Aguardando Terceiros):
--   ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
--   ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
--     CHECK (status IN ('open','in_progress','waiting_user','waiting_third_party','resolved','closed','cancelled'));
-- E se tickets.priority tiver CHECK constraint, incluir 'scheduled':
--   ALTER TABLE public.tickets DROP CONSTRAINT tickets_priority_check;
--   ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_check
--     CHECK (priority IN ('low','medium','high','critical','scheduled'));
