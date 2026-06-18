-- Adiciona prioridade padrão por categoria de chamado
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS default_priority TEXT
    CHECK (default_priority IN ('low', 'medium', 'high', 'critical'));

-- Atualiza categorias existentes com prioridades sugeridas
UPDATE public.ticket_categories SET default_priority = 'critical'
  WHERE name ILIKE '%queda%' OR name ILIKE '%sistema%' OR name ILIKE '%rede%';

UPDATE public.ticket_categories SET default_priority = 'high'
  WHERE name ILIKE '%elétri%' OR name ILIKE '%equipamento%';
