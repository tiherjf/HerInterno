-- Rastreamento de leituras de notícias por usuário
CREATE TABLE IF NOT EXISTS public.news_reads (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reads_user ON public.news_reads(user_id);

ALTER TABLE public.news_reads ENABLE ROW LEVEL SECURITY;

-- Cada usuário acessa apenas seus próprios registros de leitura
CREATE POLICY "news_reads_own" ON public.news_reads
  FOR ALL USING (user_id = auth.uid());
