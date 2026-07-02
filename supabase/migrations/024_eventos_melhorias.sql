-- ─────────────────────────────────────────────────────────────
-- Melhorias no módulo de eventos
-- ─────────────────────────────────────────────────────────────

-- Novos campos na tabela events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url      TEXT,
  ADD COLUMN IF NOT EXISTS category       TEXT NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS type           TEXT NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS meeting_link   TEXT,
  ADD COLUMN IF NOT EXISTS is_mandatory   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT now();

-- Check constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_category_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_category_check
      CHECK (category IN ('palestra','treinamento','confraternizacao','comemoracao','curso','outro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_type_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_type_check
      CHECK (type IN ('presencial','online','hibrido'));
  END IF;
END $$;

-- Check-in nas inscrições
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS checked_in    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Fila de espera
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_waitlist_event_id_idx ON public.event_waitlist (event_id, joined_at);

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waitlist_select" ON public.event_waitlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "waitlist_insert" ON public.event_waitlist FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "waitlist_delete"  ON public.event_waitlist FOR DELETE TO authenticated USING (user_id = auth.uid());
