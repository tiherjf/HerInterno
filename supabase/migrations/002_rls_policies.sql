-- ============================================================
-- Migração 002: Row Level Security (RLS) Policies
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulletin_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
-- patients e exams: NUNCA acessíveis pelo frontend (somente service role)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = TRUE LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES
-- ============================================================
-- Usuário lê apenas o próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin e TI leem todos
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti'));

-- Usuário edita apenas o próprio perfil (campos limitados)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin e TI editam todos
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti'));

-- Admin e TI inserem novos perfis
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti'));

-- ============================================================
-- NEWS
-- ============================================================
-- Todos os colaboradores autenticados leem notícias publicadas
CREATE POLICY "news_select_published"
  ON public.news FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'published');

-- Admin, TI e Marketing leem rascunhos também
CREATE POLICY "news_select_draft"
  ON public.news FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti', 'marketing'));

-- Admin, TI e Marketing criam notícias
CREATE POLICY "news_insert"
  ON public.news FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti', 'marketing'));

-- Admin, TI e Marketing editam notícias
CREATE POLICY "news_update"
  ON public.news FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti', 'marketing'));

-- Admin e TI deletam notícias
CREATE POLICY "news_delete"
  ON public.news FOR DELETE
  USING (public.get_user_role() IN ('admin', 'ti'));

-- ============================================================
-- EVENTS
-- ============================================================
CREATE POLICY "events_select"
  ON public.events FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "events_insert"
  ON public.events FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti', 'marketing'));

CREATE POLICY "events_update"
  ON public.events FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti', 'marketing'));

-- ============================================================
-- EVENT REGISTRATIONS
-- ============================================================
CREATE POLICY "event_reg_select_own"
  ON public.event_registrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "event_reg_select_admin"
  ON public.event_registrations FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti', 'marketing'));

CREATE POLICY "event_reg_insert"
  ON public.event_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_reg_delete"
  ON public.event_registrations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- EXTENSIONS (RAMAIS)
-- ============================================================
CREATE POLICY "extensions_select"
  ON public.extensions FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "extensions_insert"
  ON public.extensions FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti'));

CREATE POLICY "extensions_update"
  ON public.extensions FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti'));

CREATE POLICY "extensions_delete"
  ON public.extensions FOR DELETE
  USING (public.get_user_role() IN ('admin', 'ti'));

-- ============================================================
-- TRAININGS
-- ============================================================
CREATE POLICY "trainings_select"
  ON public.trainings FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "trainings_insert"
  ON public.trainings FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti', 'rh'));

CREATE POLICY "trainings_update"
  ON public.trainings FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- ============================================================
-- TRAINING QUESTIONS
-- ============================================================
CREATE POLICY "training_questions_select"
  ON public.training_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "training_questions_manage"
  ON public.training_questions FOR ALL
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- ============================================================
-- TRAINING COMPLETIONS
-- ============================================================
-- Usuário vê apenas as próprias conclusões
CREATE POLICY "training_completions_select_own"
  ON public.training_completions FOR SELECT
  USING (user_id = auth.uid());

-- RH, Admin e TI veem todas
CREATE POLICY "training_completions_select_admin"
  ON public.training_completions FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- Usuário insere apenas a própria conclusão
CREATE POLICY "training_completions_insert"
  ON public.training_completions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Upsert para retry de avaliação
CREATE POLICY "training_completions_update"
  ON public.training_completions FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT
  WITH CHECK (public.get_user_role() IN ('admin', 'ti', 'rh'));

CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- ============================================================
-- CHATBOT KNOWLEDGE
-- ============================================================
CREATE POLICY "chatbot_select"
  ON public.chatbot_knowledge FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "chatbot_manage"
  ON public.chatbot_knowledge FOR ALL
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- ============================================================
-- BULLETIN CARDS (MURAL)
-- ============================================================
CREATE POLICY "bulletin_select"
  ON public.bulletin_cards FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "bulletin_manage"
  ON public.bulletin_cards FOR ALL
  USING (public.get_user_role() IN ('admin', 'ti'));

-- ============================================================
-- SURVEYS
-- ============================================================
CREATE POLICY "surveys_select"
  ON public.surveys FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = TRUE);

CREATE POLICY "surveys_manage"
  ON public.surveys FOR ALL
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

CREATE POLICY "survey_questions_select"
  ON public.survey_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "survey_questions_manage"
  ON public.survey_questions FOR ALL
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- Survey responses: qualquer colaborador autenticado insere (anônimo)
CREATE POLICY "survey_responses_insert"
  ON public.survey_responses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "survey_responses_select_admin"
  ON public.survey_responses FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti', 'rh'));

-- ============================================================
-- PATIENTS & EXAMS: NUNCA acessíveis pelo frontend
-- (apenas via service role key nas API routes)
-- ============================================================
-- Nenhuma policy para users autenticados: acesso zero pelo anon/user key
-- A service role key bypassa RLS automaticamente

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE POLICY "activity_logs_insert"
  ON public.activity_logs FOR INSERT
  WITH CHECK (TRUE);  -- qualquer request (controlado nas API routes)

CREATE POLICY "activity_logs_select"
  ON public.activity_logs FOR SELECT
  USING (public.get_user_role() IN ('admin', 'ti'));
