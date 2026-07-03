-- Gestão de Riscos (ISO 31000)
CREATE TABLE IF NOT EXISTS quality_risks (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  sector         TEXT,
  category       TEXT NOT NULL DEFAULT 'operacional', -- operacional|estrategico|financeiro|compliance|seguranca
  probability    INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact         INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  risk_score     INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
  status         TEXT NOT NULL DEFAULT 'identificado', -- identificado|em_tratamento|mitigado|aceito
  mitigation_plan TEXT,
  residual_risk  TEXT,
  owner_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_risks_sector ON quality_risks(sector);
CREATE INDEX IF NOT EXISTS idx_quality_risks_status ON quality_risks(status);
