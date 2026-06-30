-- 1. Adiciona campo unidade ao corpo clínico
ALTER TABLE public.corpo_clinico
  ADD COLUMN IF NOT EXISTS unidade TEXT NOT NULL DEFAULT 'Hospital';

-- 2. Cria tabela de procedimentos e exames por unidade
CREATE TABLE IF NOT EXISTS public.procedimentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'exame' CHECK (tipo IN ('exame', 'procedimento')),
  unidade      TEXT NOT NULL,
  descricao    TEXT,
  preparacao   TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  order_num    INTEGER NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procedimentos_unidade ON public.procedimentos(unidade);
CREATE INDEX IF NOT EXISTS idx_procedimentos_ativo   ON public.procedimentos(ativo);

ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff ve procedimentos" ON public.procedimentos
  FOR SELECT TO authenticated USING (
    ativo = true OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','ti','marketing','recepcao')
    )
  );

CREATE POLICY "Editores gerenciam procedimentos" ON public.procedimentos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','ti','marketing','recepcao')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','ti','marketing','recepcao')
  ));

-- 3. Adiciona item de menu para procedimentos
INSERT INTO public.menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit, active)
VALUES (
  'procedimentos',
  'Procedimentos e Exames',
  '/intranet/procedimentos',
  'ClipboardList',
  'Clínica',
  41,
  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo','manutencao'],
  ARRAY['admin','ti','marketing','recepcao'],
  true
)
ON CONFLICT (key) DO NOTHING;
