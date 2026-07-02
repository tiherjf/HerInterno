-- ─────────────────────────────────────────────────────────────
-- Módulo de ramais gerenciável pelo banco de dados
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ramal_setores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '📞',
  color       TEXT NOT NULL DEFAULT 'blue',
  order_index INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ramais (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id    UUID NOT NULL REFERENCES public.ramal_setores(id) ON DELETE CASCADE,
  numero      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ramal_favoritos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ramal_id   UUID NOT NULL REFERENCES public.ramais(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ramal_id)
);

CREATE INDEX IF NOT EXISTS ramais_setor_idx ON public.ramais (setor_id, order_index);

-- RLS
ALTER TABLE public.ramal_setores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramais          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramal_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_select" ON public.ramal_setores  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rs_all"    ON public.ramal_setores  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "r_select"  ON public.ramais          FOR SELECT TO authenticated USING (true);
CREATE POLICY "r_all"     ON public.ramais          FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rf_select" ON public.ramal_favoritos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "rf_insert" ON public.ramal_favoritos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "rf_delete" ON public.ramal_favoritos FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── Seed: setores ────────────────────────────────────────────
INSERT INTO public.ramal_setores (id, name, icon, color, order_index) VALUES
  ('00000001-0000-0000-0000-000000000001', 'Térreo',        '🏥', 'blue',   0),
  ('00000001-0000-0000-0000-000000000002', '1º Andar',      '🔼', 'purple', 1),
  ('00000001-0000-0000-0000-000000000003', '2º Andar',      '🔼', 'teal',   2),
  ('00000001-0000-0000-0000-000000000004', '3º Andar',      '🔼', 'orange', 3),
  ('00000001-0000-0000-0000-000000000005', 'Ed. Milan',     '🏢', 'indigo', 4),
  ('00000001-0000-0000-0000-000000000006', 'Saúde Auditiva','👂', 'green',  5),
  ('00000001-0000-0000-0000-000000000007', 'Instituto',     '🏛️','rose',   6),
  ('00000001-0000-0000-0000-000000000008', 'Clínica Exame', '🔬', 'cyan',   7),
  ('00000001-0000-0000-0000-000000000009', 'Instituto Levy','🏥', 'amber',  8)
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: ramais — Térreo ────────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000001','4912','Recepção Térreo',0),
  ('00000001-0000-0000-0000-000000000001','4932','Recepção 2',1),
  ('00000001-0000-0000-0000-000000000001','4953','Enfermagem Ambulatório',2),
  ('00000001-0000-0000-0000-000000000001','4968','Triagem (Andréia)',3),
  ('00000001-0000-0000-0000-000000000001','4956','Exames',4),
  ('00000001-0000-0000-0000-000000000001','4987','Laboratório Carlos Chagas',5),
  ('00000001-0000-0000-0000-000000000001','4966','Estacionamento (Ronaldo)',6),
  ('00000001-0000-0000-0000-000000000001','4955','Ouvidoria (Laura)',7),
  ('00000001-0000-0000-0000-000000000001','4851','Líder de Atendimento (Fran)',8),
  ('00000001-0000-0000-0000-000000000001','4908','Otorrino Consultório 1 — Dr. Evandro',9),
  ('00000001-0000-0000-0000-000000000001','4904','Otorrino Consultório 2 — Dra. Regina',10),
  ('00000001-0000-0000-0000-000000000001','4909','Otorrino Consultório 3 — Dr. Pedro',11),
  ('00000001-0000-0000-0000-000000000001','4906','Otorrino Consultório 4',12),
  ('00000001-0000-0000-0000-000000000001','4931','Otorrino Consultório 5 — Dr. Lindomar',13),
  ('00000001-0000-0000-0000-000000000001','4945','Otorrino Consultório 6',14),
  ('00000001-0000-0000-0000-000000000001','4922','Otorrino Consultório 7',15),
  ('00000001-0000-0000-0000-000000000001','4925','Otorrino Consultório 8',16),
  ('00000001-0000-0000-0000-000000000001','4985','Otorrino Consultório 9',17),
  ('00000001-0000-0000-0000-000000000001','4854','Otorrino Consultório 10',18),
  ('00000001-0000-0000-0000-000000000001','4850','Otorrino Consultório 11',19),
  ('00000001-0000-0000-0000-000000000001','4986','Otorrino Consultório 12',20);

-- ─── Seed: ramais — 1º Andar ─────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000002','4921','Recepção Centro Cirúrgico',0),
  ('00000001-0000-0000-0000-000000000002','4941','Recepção Centro Cirúrgico 2',1),
  ('00000001-0000-0000-0000-000000000002','4919','Conforto Médico',2),
  ('00000001-0000-0000-0000-000000000002','4914','Agendamento Cirúrgico (Rhayane)',3),
  ('00000001-0000-0000-0000-000000000002','4937','Apartamento 1',4),
  ('00000001-0000-0000-0000-000000000002','4938','Apartamento 2',5),
  ('00000001-0000-0000-0000-000000000002','4939','Apartamento 3',6),
  ('00000001-0000-0000-0000-000000000002','N/A', 'Apartamento 4',7),
  ('00000001-0000-0000-0000-000000000002','4957','Apartamento 5',8),
  ('00000001-0000-0000-0000-000000000002','4970','Apartamento 6',9),
  ('00000001-0000-0000-0000-000000000002','4972','Apartamento 7',10),
  ('00000001-0000-0000-0000-000000000002','4917','Apartamento 8',11),
  ('00000001-0000-0000-0000-000000000002','4965','Apartamento 9',12);

-- ─── Seed: ramais — 2º Andar ─────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000003','4967','Recepção Audiometria 1',0),
  ('00000001-0000-0000-0000-000000000003','4902','Recepção Audiometria 2',1),
  ('00000001-0000-0000-0000-000000000003','4907','Audiometria 2',2),
  ('00000001-0000-0000-0000-000000000003','4995','Internação (Glaubert)',3),
  ('00000001-0000-0000-0000-000000000003','4975','Setor de Guias (Lara e Rozane)',4),
  ('00000001-0000-0000-0000-000000000003','4982','Dermatologia e Rinoplastia (Leonardo)',5),
  ('00000001-0000-0000-0000-000000000003','4976','Plástica (Elaine e Rafael)',6),
  ('00000001-0000-0000-0000-000000000003','4997','Recepção Dermatologia (Emilaine e Giulia)',7),
  ('00000001-0000-0000-0000-000000000003','4983','Recepção Oftalmo (Maria Izabel)',8),
  ('00000001-0000-0000-0000-000000000003','4963','Oftalmo (Dra. Márcia)',9),
  ('00000001-0000-0000-0000-000000000003','4964','Recepção Oftalmo (Dra. Márcia)',10);

-- ─── Seed: ramais — 3º Andar ─────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000004','4969','Centro de Estudos',0),
  ('00000001-0000-0000-0000-000000000004','4924','RH (Sabrina e Igor)',1),
  ('00000001-0000-0000-0000-000000000004','4905','Farmácia (Ana Paula, Andressa e Tais)',2),
  ('00000001-0000-0000-0000-000000000004','4936','TI (Alexandre, Gabriel, Mateus)',3),
  ('00000001-0000-0000-0000-000000000004','4920','Lavanderia / Copa (Michelle)',4),
  ('00000001-0000-0000-0000-000000000004','9970','SHL / SND (Michelle e Marco)',5),
  ('00000001-0000-0000-0000-000000000004','4990','Recepção 3º Andar (Greicielly)',6),
  ('00000001-0000-0000-0000-000000000004','4991','Consultório 21',7),
  ('00000001-0000-0000-0000-000000000004','4992','Consultório 22',8),
  ('00000001-0000-0000-0000-000000000004','4993','Consultório 23',9);

-- ─── Seed: ramais — Ed. Milan ─────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000005','4903','Direção (Virgínia)',0),
  ('00000001-0000-0000-0000-000000000005','4911','Financeiro (Raquel)',1),
  ('00000001-0000-0000-0000-000000000005','4923','Manutenção (Brenio)',2),
  ('00000001-0000-0000-0000-000000000005','4913','Faturamento Ambulatório (Tayná)',3),
  ('00000001-0000-0000-0000-000000000005','4934','Faturamento Cirúrgico (Vivian)',4),
  ('00000001-0000-0000-0000-000000000005','4935','Gerência (Camila)',5),
  ('00000001-0000-0000-0000-000000000005','4977','Marketing e Comunicação (Laura)',6),
  ('00000001-0000-0000-0000-000000000005','4930','Qualidade (Mariana)',7),
  ('00000001-0000-0000-0000-000000000005','4910','Custos (Claudia Guerra)',8),
  ('00000001-0000-0000-0000-000000000005','4949','Custos (Matheus Dutra)',9),
  ('00000001-0000-0000-0000-000000000005','4915','Comercial (Natália)',10),
  ('00000001-0000-0000-0000-000000000005','4943','Telefonia 1',11),
  ('00000001-0000-0000-0000-000000000005','4944','Telefonia 2',12),
  ('00000001-0000-0000-0000-000000000005','4901','Telefonia 3 (Gislaine)',13),
  ('00000001-0000-0000-0000-000000000005','4959','Telefonia 4',14),
  ('00000001-0000-0000-0000-000000000005','4996','Telefonia 5',15);

-- ─── Seed: ramais — Saúde Auditiva ───────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000006','4856','Recepção (Vanessa)',0),
  ('00000001-0000-0000-0000-000000000006','4857','Recepção (Gabriela)',1),
  ('00000001-0000-0000-0000-000000000006','4928','Fonoaudióloga (Roberta)',2),
  ('00000001-0000-0000-0000-000000000006','4946','Assistente Social (Vanessa)',3),
  ('00000001-0000-0000-0000-000000000006','4947','Fonoaudióloga (Susana)',4),
  ('00000001-0000-0000-0000-000000000006','4958','Arquivo (Erica)',5),
  ('00000001-0000-0000-0000-000000000006','4960','Psicologia (Rogério)',6),
  ('00000001-0000-0000-0000-000000000006','4948','Faturamento (Liliane)',7),
  ('00000001-0000-0000-0000-000000000006','4929','Faturamento Saúde Auditiva',8);

-- ─── Seed: ramais — Instituto ─────────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000007','9978','Instituto — Recepção',0),
  ('00000001-0000-0000-0000-000000000007','4940','Instituto — Financeiro',1),
  ('00000001-0000-0000-0000-000000000007','4861','Instituto — Agendamento',2),
  ('00000001-0000-0000-0000-000000000007','4939','Instituto — Coordenação',3);

-- ─── Seed: ramais — Clínica Exame ────────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000008','4898','Recepção Clínica Exame',0),
  ('00000001-0000-0000-0000-000000000008','(32) 3257-6464','Clínica Exame',1);

-- ─── Seed: ramais — Instituto Levy ───────────────────────────
INSERT INTO public.ramais (setor_id, numero, descricao, order_index) VALUES
  ('00000001-0000-0000-0000-000000000009','4863','Recepção Levy',0),
  ('00000001-0000-0000-0000-000000000009','4864','Consultório 1',1),
  ('00000001-0000-0000-0000-000000000009','4865','Consultório 2',2);
