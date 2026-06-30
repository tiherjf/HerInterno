-- Bucket público para imagens de notícias e conteúdo editorial
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de acesso
DO $$
BEGIN
  -- Leitura pública (qualquer pessoa pode ver imagens)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'media_select' AND tablename = 'objects') THEN
    CREATE POLICY "media_select" ON storage.objects
      FOR SELECT USING (bucket_id = 'media');
  END IF;

  -- Upload: usuários autenticados com papel editorial
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'media_insert' AND tablename = 'objects') THEN
    CREATE POLICY "media_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'media'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'ti', 'marketing')
            AND active = true
        )
      );
  END IF;

  -- Substituição (upsert): mesmos critérios do insert
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'media_update' AND tablename = 'objects') THEN
    CREATE POLICY "media_update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'media'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'ti', 'marketing')
            AND active = true
        )
      );
  END IF;

  -- Exclusão: somente admin/ti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'media_delete' AND tablename = 'objects') THEN
    CREATE POLICY "media_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'media'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'ti')
            AND active = true
        )
      );
  END IF;
END $$;
