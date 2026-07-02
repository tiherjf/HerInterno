-- Campos adicionais para chamados de manutenção
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('muito_alta', 'alta', 'media', 'baixa')),
  ADD COLUMN IF NOT EXISTS equipment_description TEXT,
  ADD COLUMN IF NOT EXISTS equipment_patrimonio TEXT;
