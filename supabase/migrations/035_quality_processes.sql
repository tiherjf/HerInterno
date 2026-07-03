-- Mapa de Processos
CREATE TABLE IF NOT EXISTS quality_processes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  sector      TEXT,
  process_type TEXT NOT NULL DEFAULT 'operacional', -- estrategico|gerencial|operacional|apoio
  owner_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  inputs      TEXT[] DEFAULT ARRAY[]::TEXT[],
  outputs     TEXT[] DEFAULT ARRAY[]::TEXT[],
  suppliers   TEXT[] DEFAULT ARRAY[]::TEXT[], -- fornecedores internos/externos
  customers   TEXT[] DEFAULT ARRAY[]::TEXT[], -- clientes internos/externos
  risks       TEXT[] DEFAULT ARRAY[]::TEXT[],
  indicators  TEXT[] DEFAULT ARRAY[]::TEXT[], -- nomes dos indicadores vinculados
  order_num   INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'ativo', -- ativo|em_revisao|obsoleto
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_processes_sector ON quality_processes(sector);
