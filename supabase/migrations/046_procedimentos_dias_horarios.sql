-- 046: Dias e horários de realização nos procedimentos/exames
-- Padroniza o layout com o corpo clínico. Aplicar no SQL Editor do Supabase.
ALTER TABLE public.procedimentos
  ADD COLUMN IF NOT EXISTS dias TEXT,
  ADD COLUMN IF NOT EXISTS horarios TEXT;
