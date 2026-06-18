-- ============================================================
-- Migração 001: Schema inicial — Intranet HER
-- Hospital Evandro Ribeiro, Juiz de Fora, MG
-- ============================================================

-- Perfis de colaboradores (extensão da tabela auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','ti','marketing','rh','recepcao','enfermagem','administrativo')),
  sector TEXT,
  unit TEXT DEFAULT 'Matriz',
  phone_ext TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para criar perfil automaticamente ao criar usuário (opcional)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Perfil criado manualmente pelo admin; apenas registra timestamp
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notícias e comunicados
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  category TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  max_slots INTEGER DEFAULT 50,
  slots_used INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inscrições em eventos
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Trigger para controle atômico de vagas
CREATE OR REPLACE FUNCTION public.handle_event_registration()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events
    SET slots_used = slots_used + 1
    WHERE id = NEW.event_id AND slots_used < max_slots;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vagas esgotadas ou evento não encontrado';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events
    SET slots_used = GREATEST(0, slots_used - 1)
    WHERE id = OLD.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_event_registration
  AFTER INSERT OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_registration();

-- Lista de ramais
CREATE TABLE IF NOT EXISTS public.extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT,
  unit TEXT DEFAULT 'Matriz',
  extension TEXT,
  mobile TEXT,
  email TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treinamentos
CREATE TABLE IF NOT EXISTS public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  material_url TEXT,
  workload_hours NUMERIC DEFAULT 1,
  passing_score INTEGER DEFAULT 70,
  min_questions INTEGER DEFAULT 5,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questões dos treinamentos
CREATE TABLE IF NOT EXISTS public.training_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,  -- array de strings
  correct_index INTEGER NOT NULL,
  order_num INTEGER DEFAULT 0
);

-- Conclusões de treinamento
CREATE TABLE IF NOT EXISTS public.training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  certificate_url TEXT,
  UNIQUE(training_id, user_id)
);

-- Pacientes (auth própria, sem Supabase Auth)
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exames de vídeo
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  exam_type TEXT,
  exam_date DATE,
  description TEXT,
  video_filename TEXT,  -- nome do arquivo no servidor local (nunca expor path real)
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base de documentos
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,  -- POP, Protocolo, Formulário, Manual, Outros
  sector TEXT,
  tags TEXT[] DEFAULT '{}',
  file_url TEXT,
  file_type TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Base de conhecimento do chatbot
CREATE TABLE IF NOT EXISTS public.chatbot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- rh, ti, ramais, geral, treinamentos
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mural digital
CREATE TABLE IF NOT EXISTS public.bulletin_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type TEXT NOT NULL,  -- 'birthday', 'schedule', 'holiday', 'notice'
  title TEXT,
  content TEXT,
  image_url TEXT,
  display_date DATE,
  expires_at DATE,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pesquisas NPS
CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'nps' CHECK (question_type IN ('nps','text','rating')),
  order_num INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  responded_at TIMESTAMPTZ DEFAULT NOW()
  -- Sem user_id para garantir anonimato
);

-- Log de atividades
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,  -- pode ser null para ações anônimas
  user_type TEXT CHECK (user_type IN ('staff','patient')),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_news_status ON public.news(status);
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_user ON public.training_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_patient ON public.exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf);
CREATE INDEX IF NOT EXISTS idx_extensions_sector ON public.extensions(sector);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_category ON public.chatbot_knowledge(category);
