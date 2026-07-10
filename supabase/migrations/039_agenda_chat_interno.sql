-- 039: Agenda estruturada do corpo clínico + chat interno
-- Aplicar no SQL Editor do Supabase Dashboard.

-- 1. Agenda estruturada do corpo clínico
-- Formato: [{"dia": 1, "inicio": "08:00", "fim": "12:00"}, ...]
-- dia: 0=domingo, 1=segunda, ..., 6=sábado
ALTER TABLE public.corpo_clinico ADD COLUMN IF NOT EXISTS agenda JSONB;

-- 2. Chat interno — mensagens diretas entre colaboradores
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient
  ON public.chat_messages (recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pair
  ON public.chat_messages (sender_id, recipient_id, created_at);

-- Acesso somente via API (service role bypassa RLS); sem policies para clientes.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
