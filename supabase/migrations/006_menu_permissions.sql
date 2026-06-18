-- Permissões dinâmicas de menu por perfil
CREATE TABLE IF NOT EXISTS public.menu_permissions (
  key         TEXT PRIMARY KEY,
  label       TEXT    NOT NULL,
  href        TEXT    NOT NULL,
  icon        TEXT    NOT NULL,
  category    TEXT    NOT NULL,
  order_num   INTEGER NOT NULL DEFAULT 0,
  can_view    TEXT[]  NOT NULL DEFAULT ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'],
  can_edit    TEXT[]  NOT NULL DEFAULT ARRAY['admin','ti'],
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit) VALUES
  ('noticias',         'Notícias',         '/intranet/noticias',          'Newspaper',    'Comunicação', 1,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','marketing']),
  ('eventos',          'Eventos',          '/intranet/eventos',           'Calendar',     'Comunicação', 2,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','marketing']),
  ('corpo-clinico',    'Corpo Clínico',    '/intranet/corpo-clinico',     'Stethoscope',  'Clínica',     3,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti']),
  ('ramais',           'Ramais',           '/intranet/ramais',            'Phone',        'Clínica',     4,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti']),
  ('treinamentos',     'Treinamentos',     '/intranet/treinamentos',      'GraduationCap','Capacitação', 5,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','rh']),
  ('documentos',       'Documentos',       '/intranet/documentos',        'FileText',     'Capacitação', 6,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','rh']),
  ('assistente',       'Assistente IA',    '/intranet/assistente',        'Brain',        'Suporte',     7,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti']),
  ('chamados',         'Chamados TI',      '/intranet/chamados',          'Ticket',       'Suporte',     8,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti']),
  ('ponto',            'Meu Ponto',        '/intranet/ponto',             'Clock',        'Ponto',       9,  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','rh']),
  ('ponto-calendario', 'Calendário Ponto', '/intranet/ponto/calendario',  'CalendarDays', 'Ponto',       10, ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'], ARRAY['admin','ti','rh'])
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaboradores leem menu"
  ON public.menu_permissions FOR SELECT TO authenticated
  USING (active = TRUE);

CREATE POLICY "TI e Marketing gerenciam menu"
  ON public.menu_permissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ti', 'marketing')
      AND active = TRUE
    )
  );
