-- Migration 028: Calendário de feriados para o módulo Ponto

CREATE TABLE IF NOT EXISTS ponto_feriados (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('nacional', 'estadual', 'municipal', 'hospital')),
  created_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feriados nacionais 2025
INSERT INTO ponto_feriados (date, name, type) VALUES
  ('2025-01-01', 'Confraternização Universal',          'nacional'),
  ('2025-03-04', 'Carnaval',                            'nacional'),
  ('2025-03-05', 'Carnaval',                            'nacional'),
  ('2025-04-18', 'Paixão de Cristo',                    'nacional'),
  ('2025-04-21', 'Tiradentes',                          'nacional'),
  ('2025-05-01', 'Dia do Trabalho',                     'nacional'),
  ('2025-06-19', 'Corpus Christi',                      'nacional'),
  ('2025-09-07', 'Independência do Brasil',             'nacional'),
  ('2025-10-12', 'Nossa Senhora Aparecida',             'nacional'),
  ('2025-11-02', 'Finados',                             'nacional'),
  ('2025-11-15', 'Proclamação da República',            'nacional'),
  ('2025-11-20', 'Consciência Negra',                   'nacional'),
  ('2025-12-25', 'Natal',                               'nacional')
ON CONFLICT (date) DO NOTHING;

-- Feriados nacionais 2026
INSERT INTO ponto_feriados (date, name, type) VALUES
  ('2026-01-01', 'Confraternização Universal',          'nacional'),
  ('2026-02-17', 'Carnaval',                            'nacional'),
  ('2026-02-18', 'Carnaval',                            'nacional'),
  ('2026-04-03', 'Paixão de Cristo',                    'nacional'),
  ('2026-04-21', 'Tiradentes',                          'nacional'),
  ('2026-05-01', 'Dia do Trabalho',                     'nacional'),
  ('2026-06-04', 'Corpus Christi',                      'nacional'),
  ('2026-09-07', 'Independência do Brasil',             'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida',             'nacional'),
  ('2026-11-02', 'Finados',                             'nacional'),
  ('2026-11-15', 'Proclamação da República',            'nacional'),
  ('2026-11-20', 'Consciência Negra',                   'nacional'),
  ('2026-12-25', 'Natal',                               'nacional')
ON CONFLICT (date) DO NOTHING;
