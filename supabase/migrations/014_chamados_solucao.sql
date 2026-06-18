-- Adiciona campo de solução obrigatório para resolver chamados
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS solution TEXT;
