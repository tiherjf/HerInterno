-- Migration 029: Módulo de Gestão da Qualidade (inspirado no SigQuali)

-- ─── Sequência para numeração de NCs ───────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS quality_nc_seq START 1;

-- ─── Não-Conformidades ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_ncs (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  number           TEXT        NOT NULL DEFAULT ('NC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('quality_nc_seq')::TEXT, 3, '0')),
  title            TEXT        NOT NULL,
  description      TEXT,
  category         TEXT        NOT NULL CHECK (category IN ('processo', 'produto_servico', 'sistemica', 'seguranca')),
  origin           TEXT        NOT NULL CHECK (origin IN ('auditoria_interna', 'auditoria_externa', 'reclamacao', 'observacao', 'indicador', 'visa', 'outro')),
  sector           TEXT,
  severity         TEXT        NOT NULL CHECK (severity IN ('critica', 'maior', 'menor', 'observacao')),
  responsible_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'plano_definido', 'em_execucao', 'verificacao', 'concluida', 'cancelada')),
  occurrence_date  DATE,
  deadline         DATE,
  root_cause       TEXT,
  immediate_action TEXT,
  effectiveness_check TEXT,
  conclusion       TEXT,
  created_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Planos de Ação 5W2H ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_action_plans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nc_id       UUID        NOT NULL REFERENCES quality_ncs(id) ON DELETE CASCADE,
  what        TEXT        NOT NULL,
  why         TEXT        NOT NULL,
  who_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  where_loc   TEXT,
  when_date   DATE,
  how         TEXT,
  how_much    TEXT,
  status      TEXT        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Histórico de NCs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_nc_history (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nc_id            UUID        NOT NULL REFERENCES quality_ncs(id) ON DELETE CASCADE,
  actor_id         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name       TEXT,
  action           TEXT        NOT NULL,
  previous_status  TEXT,
  new_status       TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indicadores de Qualidade ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_indicators (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        NOT NULL,
  description    TEXT,
  formula        TEXT,
  unit           TEXT        NOT NULL DEFAULT '%',
  frequency      TEXT        NOT NULL DEFAULT 'mensal' CHECK (frequency IN ('mensal', 'trimestral', 'semestral', 'anual')),
  target_value   NUMERIC,
  min_value      NUMERIC,
  sector         TEXT,
  category       TEXT,
  responsible_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lançamentos mensais de indicadores ────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_indicator_records (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_id    UUID        NOT NULL REFERENCES quality_indicators(id) ON DELETE CASCADE,
  reference_month DATE        NOT NULL,
  actual_value    NUMERIC     NOT NULL,
  observations    TEXT,
  recorded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (indicator_id, reference_month)
);

-- ─── Documentos Controlados ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_documents (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code             TEXT,
  title            TEXT        NOT NULL,
  doc_type         TEXT        NOT NULL CHECK (doc_type IN ('pop', 'protocolo', 'politica', 'manual', 'instrucao', 'formulario')),
  category         TEXT,
  version          TEXT        NOT NULL DEFAULT '1.0',
  content          TEXT,
  file_url         TEXT,
  status           TEXT        NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'revisao', 'aprovado', 'publicado', 'obsoleto')),
  requires_reading BOOLEAN     NOT NULL DEFAULT FALSE,
  valid_from       DATE,
  valid_until      DATE,
  created_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Confirmações de leitura ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_document_reads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID        NOT NULL REFERENCES quality_documents(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, user_id)
);

-- ─── Versões anteriores de documentos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_document_versions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID        NOT NULL REFERENCES quality_documents(id) ON DELETE CASCADE,
  version     TEXT        NOT NULL,
  file_url    TEXT,
  content     TEXT,
  change_note TEXT,
  changed_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Auditorias ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_audits (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title             TEXT        NOT NULL,
  audit_type        TEXT        NOT NULL CHECK (audit_type IN ('interna', 'externa')),
  auditor_id        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  auditor_external  TEXT,
  scope             TEXT,
  audit_date        DATE,
  status            TEXT        NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  report            TEXT,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Achados de auditoria ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_audit_findings (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id      UUID        NOT NULL REFERENCES quality_audits(id) ON DELETE CASCADE,
  finding_type  TEXT        NOT NULL CHECK (finding_type IN ('nc', 'observacao', 'oportunidade')),
  description   TEXT        NOT NULL,
  sector        TEXT,
  nc_id         UUID        REFERENCES quality_ncs(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Menu entries para Qualidade ────────────────────────────────────────────
INSERT INTO menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit, active) VALUES
  ('qualidade',               'Qualidade',           '/intranet/qualidade',                        'ShieldCheck',  'Qualidade', 70, ARRAY['admin','ti','rh'], ARRAY['admin','ti','rh'], true),
  ('qualidade_ncs',           'Não-Conformidades',   '/intranet/qualidade/nao-conformidades',      'AlertTriangle','Qualidade', 71, ARRAY['admin','ti','rh'], ARRAY['admin','ti','rh'], true),
  ('qualidade_indicadores',   'Indicadores',         '/intranet/qualidade/indicadores',            'BarChart2',    'Qualidade', 72, ARRAY['admin','ti','rh'], ARRAY['admin','ti','rh'], true),
  ('qualidade_documentos',    'Documentos',          '/intranet/qualidade/documentos',             'FileText',     'Qualidade', 73, ARRAY['admin','ti','rh'], ARRAY['admin','ti','rh'], true),
  ('qualidade_auditorias',    'Auditorias',          '/intranet/qualidade/auditorias',             'ClipboardList','Qualidade', 74, ARRAY['admin','ti','rh'], ARRAY['admin','ti','rh'], true)
ON CONFLICT (key) DO NOTHING;
