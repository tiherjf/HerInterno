-- Depreciação de equipamentos no inventário de TI
ALTER TABLE public.asset_inventory
  ADD COLUMN IF NOT EXISTS purchase_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS useful_life_months INTEGER DEFAULT 60;

COMMENT ON COLUMN public.asset_inventory.purchase_value IS 'Valor de compra do equipamento (R$)';
COMMENT ON COLUMN public.asset_inventory.useful_life_months IS 'Vida útil esperada em meses (padrão RFB: 60 meses = 5 anos)';
