-- ─────────────────────────────────────────────────────────────
-- Melhorias no módulo de notícias
-- ─────────────────────────────────────────────────────────────

-- Suporte a agendamento
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Comentários em notícias
CREATE TABLE IF NOT EXISTS public.news_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id     UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_comments_news_id_idx ON public.news_comments (news_id);

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_comments_select" ON public.news_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "news_comments_insert" ON public.news_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "news_comments_delete_own" ON public.news_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());
