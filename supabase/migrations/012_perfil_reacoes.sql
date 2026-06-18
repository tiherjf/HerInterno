-- Avatar para colaboradores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Políticas: colaborador pode atualizar seu próprio perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_self_update' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "profiles_self_update" ON public.profiles
      FOR UPDATE USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Bucket de avatars (público, 2MB max, imagens apenas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_select' AND tablename = 'objects') THEN
    CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_insert' AND tablename = 'objects') THEN
    CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'avatars' AND auth.uid() IS NOT NULL
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'avatars_update' AND tablename = 'objects') THEN
    CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (
      bucket_id = 'avatars' AND auth.uid() IS NOT NULL
    );
  END IF;
END $$;

-- Reações em notícias (curtidas)
CREATE TABLE IF NOT EXISTS public.news_reactions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reactions_news ON public.news_reactions(news_id);
CREATE INDEX IF NOT EXISTS idx_news_reactions_user ON public.news_reactions(user_id);

ALTER TABLE public.news_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.news_reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "reactions_insert" ON public.news_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON public.news_reactions
  FOR DELETE USING (user_id = auth.uid());
