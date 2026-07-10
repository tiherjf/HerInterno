-- Restringe leitura de justification_types a usuários autenticados.
-- Hoje a tabela está legível pela anon key (única tabela exposta no diagnóstico de 2026-07-09).
-- Aplicar no SQL Editor do Supabase Dashboard.

ALTER TABLE public.justification_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura autenticada" ON public.justification_types;
CREATE POLICY "leitura autenticada" ON public.justification_types
  FOR SELECT TO authenticated USING (active = TRUE);
