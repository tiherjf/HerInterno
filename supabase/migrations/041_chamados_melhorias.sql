-- 041: Melhorias de chamados — SLA pausado, alertas, custo de manutenção e preventivas
-- Aplicar no SQL Editor do Supabase Dashboard.

-- Novas colunas em tickets:
--   waiting_since   → quando entrou em "Aguardando usuário" (pausa o SLA)
--   sla_alerted_at  → quando o alerta de SLA prestes a estourar foi enviado (evita repetição)
--   materials/cost  → materiais usados e custo ao resolver (manutenção)
--   plan_id         → vínculo com o plano de manutenção preventiva que gerou o chamado
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_alerted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS materials TEXT,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS plan_id UUID;

-- ATENÇÃO: se a coluna tickets.status tiver uma CHECK constraint com a lista de
-- status permitidos, é preciso recriá-la incluindo 'waiting_user'. Exemplo:
--   ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
--   ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
--     CHECK (status IN ('open','in_progress','waiting_user','resolved','closed','cancelled'));

-- Planos de manutenção preventiva: geram chamados automaticamente na data
CREATE TABLE IF NOT EXISTS public.maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  equipment_patrimonio TEXT,
  category_id UUID,
  frequency_days INTEGER NOT NULL CHECK (frequency_days > 0),
  next_due DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Acesso somente via API (service role bypassa RLS); sem policies para clientes.
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
