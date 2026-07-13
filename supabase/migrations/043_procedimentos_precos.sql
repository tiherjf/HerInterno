-- 043: Preços e categorias para procedimentos/exames
-- Aplicar no SQL Editor do Supabase Dashboard.

-- Adiciona suporte a tabela de preços agrupada por categoria (ex.: tabela de
-- procedimentos de dermatologia). Colunas opcionais — não quebram itens
-- existentes que só usam nome/tipo/unidade/descrição/preparo.
--   categoria       = seção da tabela (ex.: "Peeling", "Toxina botulínica")
--   preco           = valor em reais
--   unidade_medida  = unidade do preço (ex.: "sessão", "ampola", "frasco")
--   protocolo       = observação de protocolo/parcelamento (ex.: "3 sessões: R$ 1.200,00")
--   profissional    = profissional(is) responsável(is)
ALTER TABLE public.procedimentos
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS preco NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unidade_medida TEXT,
  ADD COLUMN IF NOT EXISTS protocolo TEXT,
  ADD COLUMN IF NOT EXISTS profissional TEXT;
