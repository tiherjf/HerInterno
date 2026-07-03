-- Adiciona campo 5 Porquês às NCs de qualidade
ALTER TABLE quality_ncs
  ADD COLUMN IF NOT EXISTS cinco_porques TEXT[] DEFAULT ARRAY[]::TEXT[];
