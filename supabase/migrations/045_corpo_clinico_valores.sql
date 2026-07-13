-- 045: Valores de consulta, convênios, idade mínima e localização no corpo clínico
-- Aplicar no SQL Editor do Supabase Dashboard.
--
-- Três valores de consulta (conforme tabela do corpo clínico):
--   valor_particular  = particular
--   valor_convenio    = pequenos convênios
--   valor_desconto    = particular com desconto
ALTER TABLE public.corpo_clinico
  ADD COLUMN IF NOT EXISTS valor_particular NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_convenio NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS convenios TEXT[],
  ADD COLUMN IF NOT EXISTS idade_minima INTEGER,
  ADD COLUMN IF NOT EXISTS local TEXT,
  ADD COLUMN IF NOT EXISTS subespecialidade TEXT;
