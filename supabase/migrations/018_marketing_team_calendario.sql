-- 1. Corrige label do menu de ponto-calendario
UPDATE public.menu_permissions
  SET label = 'Calendário de Ponto'
  WHERE key = 'ponto-calendario';

-- 2. Permite categoria com team = marketing (ticket_categories)
-- Sem migration necessária — team é TEXT sem CHECK constraint

-- 3. Marketing role pode ser agente de tickets (sem migration — is_agent é calculado em código)
-- Confirmação: roles válidas incluem 'marketing' no check de agentes
