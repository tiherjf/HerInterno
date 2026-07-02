-- ─────────────────────────────────────────────────────────────
-- Módulos de treinamento com vídeos do YouTube
-- ─────────────────────────────────────────────────────────────

-- Tabela de módulos
CREATE TABLE IF NOT EXISTS public.training_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_select" ON public.training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "tm_all"    ON public.training_modules FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Novos campos na tabela trainings existente
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS module_id        UUID REFERENCES public.training_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS youtube_id       TEXT,
  ADD COLUMN IF NOT EXISTS order_index      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

CREATE INDEX IF NOT EXISTS trainings_module_id_idx ON public.trainings (module_id, order_index);

-- Progresso por vídeo
CREATE TABLE IF NOT EXISTS public.training_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  watched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, training_id)
);

ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select" ON public.training_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tp_insert" ON public.training_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tp_delete" ON public.training_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Módulos iniciais
INSERT INTO public.training_modules (name, description, order_index) VALUES
  ('Treinamento TOTVS',   'Vídeos de treinamento do sistema TOTVS',                              0),
  ('Treinamento SIGQUALI','Vídeos de treinamento do sistema SIGQUALI',                            1),
  ('Treinamento RH',      'Vídeos de treinamento para o setor de Recursos Humanos',               2),
  ('Treinamento TI',      'Vídeos de treinamento para o setor de Tecnologia da Informação',       3)
ON CONFLICT DO NOTHING;
