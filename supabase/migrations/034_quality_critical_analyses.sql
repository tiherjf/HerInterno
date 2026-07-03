-- Análises Críticas: reuniões + diagramas Ishikawa
CREATE TABLE IF NOT EXISTS quality_critical_analyses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  analysis_date   DATE,
  next_date       DATE,
  status          TEXT NOT NULL DEFAULT 'agendada', -- agendada|realizada|cancelada
  participants    TEXT[],
  agenda          TEXT,
  decisions       TEXT,
  observations    TEXT,
  sector          TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Diagramas de Ishikawa (Espinha de Peixe) - 6M
CREATE TABLE IF NOT EXISTS quality_ishikawa (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,        -- efeito/problema
  sector      TEXT,
  nc_id       UUID REFERENCES quality_ncs(id) ON DELETE SET NULL,
  analysis_id UUID REFERENCES quality_critical_analyses(id) ON DELETE SET NULL,
  -- 6M causas (JSONB array de strings por categoria)
  metodo      TEXT[] DEFAULT ARRAY[]::TEXT[],
  mao_de_obra TEXT[] DEFAULT ARRAY[]::TEXT[],
  maquina     TEXT[] DEFAULT ARRAY[]::TEXT[],
  material    TEXT[] DEFAULT ARRAY[]::TEXT[],
  meio_ambiente TEXT[] DEFAULT ARRAY[]::TEXT[],
  medicao     TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_analyses_sector ON quality_critical_analyses(sector);
CREATE INDEX IF NOT EXISTS idx_quality_ishikawa_nc ON quality_ishikawa(nc_id);
