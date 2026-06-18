-- Migration 008: Equipe manutenção + inventário de máquinas
-- Execute no Supabase Dashboard → SQL Editor

-- ─── 1. Campo team em ticket_categories ────────────────────────────────────
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('ti', 'manutencao')) DEFAULT 'ti';

-- Atualiza categorias existentes
UPDATE public.ticket_categories SET team = 'ti'
  WHERE name IN ('TI / Suporte','Infraestrutura','Rede / Conectividade','Sistema / Software','Hardware','Segurança');

UPDATE public.ticket_categories SET team = 'manutencao'
  WHERE name IN ('Manutenção Predial','Facilities');

-- Insere categorias padrão de manutenção caso não existam
INSERT INTO public.ticket_categories (name, color, sla_hours, team, active)
VALUES
  ('Manutenção Elétrica',     '#f59e0b', 24, 'manutencao', true),
  ('Manutenção Hidráulica',   '#06b6d4', 24, 'manutencao', true),
  ('Manutenção Civil',        '#84cc16', 48, 'manutencao', true),
  ('Climatização / AR',       '#3b82f6', 24, 'manutencao', true),
  ('Manutenção de Equipamentos','#8b5cf6', 48, 'manutencao', true)
ON CONFLICT (name) DO NOTHING;

-- ─── 2. Tabela de inventário de máquinas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,                          -- hostname / apelido
  asset_type       TEXT NOT NULL,                          -- desktop, notebook, servidor, impressora, switch, etc.
  brand            TEXT,
  model            TEXT,
  serial_number    TEXT,
  asset_tag        TEXT,                                   -- número de patrimônio
  location         TEXT,                                   -- sala / andar
  assigned_to      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','maintenance','disposed')),
  purchase_date    DATE,
  warranty_expiry  DATE,
  operating_system TEXT,
  ip_address       TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_assets_status       ON public.asset_inventory(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to  ON public.asset_inventory(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type   ON public.asset_inventory(asset_type);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_asset_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_updated_at ON public.asset_inventory;
CREATE TRIGGER trg_asset_updated_at
  BEFORE UPDATE ON public.asset_inventory
  FOR EACH ROW EXECUTE FUNCTION update_asset_updated_at();

-- RLS
ALTER TABLE public.asset_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ti_gerencia_inventario" ON public.asset_inventory
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','ti') AND active = TRUE
    )
  );

-- ─── 3. Coluna team em tickets (desnormalização para filtros rápidos) ────────
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('ti','manutencao')) DEFAULT 'ti';

-- Preenche tickets existentes com base na categoria
UPDATE public.tickets t
SET team = tc.team
FROM public.ticket_categories tc
WHERE t.category_id = tc.id AND tc.team IS NOT NULL;

-- Verificar resultado:
-- SELECT name, team, sla_hours FROM public.ticket_categories ORDER BY team, name;
-- SELECT COUNT(*), team FROM public.tickets GROUP BY team;
