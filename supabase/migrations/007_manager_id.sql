-- Migration 007: Vinculo explícito gestor → funcionário
-- Execute no Supabase Dashboard → SQL Editor

-- 1. Adiciona manager_id em profiles (auto-referência)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Índice para acelerar buscas de subordinados
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);

-- 3. Garante que is_manager exista (pode já ter sido criado em 003)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_manager BOOLEAN DEFAULT FALSE;

-- 4. Atualiza RLS de justifications para que gestores vejam justificativas de seus subordinados
-- (sem RLS nova — o backend já controla via API com service role key)

-- Verificar resultado:
-- SELECT id, full_name, role, is_manager, manager_id FROM public.profiles ORDER BY full_name;
