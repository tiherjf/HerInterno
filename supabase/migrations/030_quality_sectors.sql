-- Migration 030: Setores de qualidade + consolidação do menu

CREATE TABLE IF NOT EXISTS quality_sectors (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL UNIQUE,
  description  TEXT,
  color        TEXT        NOT NULL DEFAULT 'blue',
  responsible_id UUID      REFERENCES public.profiles(id) ON DELETE SET NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  order_num    INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Setores padrão de um hospital
INSERT INTO quality_sectors (name, color, order_num) VALUES
  ('Geral',           'gray',   0),
  ('UTI',             'red',    10),
  ('Enfermagem',      'blue',   20),
  ('Farmácia',        'purple', 30),
  ('Laboratório',     'teal',   40),
  ('CME',             'orange', 50),
  ('Radiologia',      'indigo', 60),
  ('Nutrição',        'green',  70),
  ('Manutenção',      'amber',  80),
  ('Administração',   'pink',   90),
  ('Recepção',        'cyan',  100)
ON CONFLICT (name) DO NOTHING;

-- Desativa sub-menus individuais (tudo fica dentro de /intranet/qualidade)
UPDATE menu_permissions
SET active = false
WHERE key IN ('qualidade_ncs', 'qualidade_indicadores', 'qualidade_documentos', 'qualidade_auditorias');
