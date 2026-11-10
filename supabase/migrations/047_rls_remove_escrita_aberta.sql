-- ============================================================
-- 047 — Remove políticas de escrita abertas a qualquer usuário logado
-- ============================================================
-- As políticas "FOR ALL TO authenticated USING (true)" permitiam que QUALQUER
-- funcionário logado alterasse/apagasse setores de ramais, ramais e módulos de
-- treinamento direto pela API do Supabase (com a anon key + seu token),
-- contornando a checagem de permissão (canEditMenuItem) feita na intranet.
--
-- Todas as escritas legítimas passam pelas rotas /api/* com o service client
-- (que ignora RLS) após checar permissão, e os scripts usam a service role key.
-- Por isso basta remover as políticas de escrita: a leitura continua liberada
-- pelas políticas *_select, e ramal_favoritos (rf_*) não é afetada.
-- ============================================================

DROP POLICY IF EXISTS "rs_all" ON public.ramal_setores;
DROP POLICY IF EXISTS "r_all"  ON public.ramais;
DROP POLICY IF EXISTS "tm_all" ON public.training_modules;
