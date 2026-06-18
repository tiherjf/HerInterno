-- Tabela do Corpo Clínico
CREATE TABLE IF NOT EXISTS public.corpo_clinico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  grupo         TEXT NOT NULL,
  dias          TEXT NOT NULL DEFAULT '—',
  horarios      TEXT NOT NULL DEFAULT '—',
  observacoes   TEXT,
  sem_agenda    BOOLEAN NOT NULL DEFAULT FALSE,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  order_num     INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corpo_clinico_grupo ON public.corpo_clinico(grupo);
CREATE INDEX IF NOT EXISTS idx_corpo_clinico_ativo  ON public.corpo_clinico(ativo);

-- RLS
ALTER TABLE public.corpo_clinico ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os usuários autenticados
CREATE POLICY "corpo_clinico_select" ON public.corpo_clinico
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita: admin, ti, marketing, recepcao
CREATE POLICY "corpo_clinico_insert" ON public.corpo_clinico
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin','ti','marketing','recepcao')
        AND active = TRUE
    )
  );

CREATE POLICY "corpo_clinico_update" ON public.corpo_clinico
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin','ti','marketing','recepcao')
        AND active = TRUE
    )
  );

CREATE POLICY "corpo_clinico_delete" ON public.corpo_clinico
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin','ti','marketing','recepcao')
        AND active = TRUE
    )
  );

-- Seed com os dados existentes
INSERT INTO public.corpo_clinico (nome, especialidade, grupo, dias, horarios, observacoes, sem_agenda, order_num) VALUES
-- Pediatria
('Adriana da Motta Caiafa','Pediatra','Pediatria','Quarta-feira','08:00 às 13:00',NULL,FALSE,1),
('Adriana Maria Vieira Rezende','Pediatra','Pediatria','Segunda, Quarta e Quinta-feira','09:00 às 14:00',NULL,FALSE,2),
('Cynthia de Oliveira Macedo','Pediatra','Pediatria','Segunda / Terça / Quinta-feira','09:00 às 15:30 / 13:30 às 14:30 / 09:00 às 15:30',NULL,FALSE,3),
('Cyntia Vidal Merula','Pediatra','Pediatria','Segunda e Terça (15 em 15d) / Quinta (plantão)','13:30 às 16:30 / 13:30 às 18:30',NULL,FALSE,4),
('Dorian Ricardo Domingues','Pediatra','Pediatria','Seg / Ter, Qua e Qui / Sex / Sáb','18:00 às 19:00 / 15:00 às 18:40 / 09:00 às 14:00 / 09:00 às 12:00',NULL,FALSE,5),
('Edson de Lucca Marcílio','Pediatra','Pediatria','Segunda a Sexta / Sábado','09:00 às 19:00 (intervalo 12:00–14:00) / 09:00 às 12:30',NULL,FALSE,6),
('Guilherme da Silva Matos','Pediatra','Pediatria','Quinta-feira / Sábado','09:00 às 13:00 / 09:00 às 12:30','Agendamento somente com ele',FALSE,7),
('Lara Lobão Campos Bignoto','Pediatra e Hebiatra','Pediatria','Sexta e Sábado (1x/mês)','09:00 às 11:00','Especialista em medicina do adolescente',FALSE,8),
('Lucia Elena Gasparetto Bittar','Pediatra','Pediatria','Seg, Qua e Qui / Terça-feira','14:00 às 17:30 / 09:00 às 12:00',NULL,FALSE,9),
('Luciana Calderano Fiorilo','Pediatra','Pediatria','Segunda-feira','13:00 às 17:00',NULL,FALSE,10),
('Maria Fernanda Vizani Nogueira','Pediatra','Pediatria','Quarta-feira / Sábado (1x/mês)','16:30 às 19:00',NULL,FALSE,11),
('Maria Zélia Tavares Moreira','Pediatra','Pediatria','Seg e Ter / Qua e Qui','08:00 às 13:00 / 13:00 às 16:00',NULL,FALSE,12),
('Marilia Borborema Aguiar','Pediatra','Pediatria','Segunda / Terça / Quarta-feira','13:00 às 16:00 / 13:00 às 17:00 / 09:00 às 13:00',NULL,FALSE,13),
('Mirian Estevina Braga Silva','Pediatra','Pediatria','Quarta-feira / Sexta-feira','13:00 às 19:00 / 08:00 às 11:30',NULL,FALSE,14),
('Paolla Seixas Salgado','Pediatra','Pediatria','Segunda / Quinta (15 em 15d) / Sexta','14:00 às 16:00 / 09:00 às 13:00 / 13:00 às 16:00',NULL,FALSE,15),
('Renato Darcio Camilo Junior','Pediatra e Alergologista','Pediatria','Seg a Qui / Sexta / Sábado','09:00 às 12:00 e 14:30 às 17:30 / 16:00 às 18:00 / 09:00 às 12:00',NULL,FALSE,16),
('Rosane Rodrigues Rosa','Pediatra','Pediatria','Segunda / Terça / Sexta (15 em 15d)','16:00 às 18:00 / 16:00 às 19:00 / 16:00 às 19:00',NULL,FALSE,17),
('Walkyria Ferreira','Pediatra','Pediatria','Quarta / Quinta / Sexta / Sáb (15 em 15d)','09:30 às 12:00 / 13:00 às 16:00 / 13:00 às 17:00 / 09:00 às 13:00',NULL,FALSE,18),
-- Otorrinolaringologia
('Aparecida Regina Brum','Otorrino – Adulto e Infantil','Otorrinolaringologia','Segunda-feira / Sábado','09:00 às 13:00 / 09:00 às 12:30',NULL,FALSE,1),
('Joziene Aparecida Carvalho','Otorrino – Adulto e Infantil','Otorrinolaringologia','Terça-feira','16:00 às 17:30',NULL,FALSE,2),
('Maria Clara Souza Schettini','Otorrino – Adulto e Infantil','Otorrinolaringologia','Quinta-feira','08:00 às 09:45',NULL,FALSE,3),
('André Costa Pinto Ribeiro','Otorrinolaringologista','Otorrinolaringologia','—','—',NULL,TRUE,4),
('Daniel Ferreira Lana','Otorrinolaringologista','Otorrinolaringologia','—','—',NULL,TRUE,5),
('Laura Rodrigues Sefair','Otorrino Pediatra','Otorrinolaringologia','—','—',NULL,TRUE,6),
-- Cirurgia
('Aimeé Cabral Ramalhete','Cirurgiã Pediátrica','Cirurgia','Quarta-feira','15:20 às 17:00',NULL,FALSE,1),
('Matheus Mousinho','Cirurgião Cabeça e Pescoço','Cirurgia','Sexta-feira','09:00 às 10:30',NULL,FALSE,2),
-- Dermatologia
('Alexandre Francisco Caniato Serdeira','Dermatologista – Adulto e Infantil','Dermatologia','Quinta-feira','09:00 às 10:45',NULL,FALSE,1),
-- Alergia e Imunologia
('Christiane Mendonça Valente','Alergologia e Imunologia – Adulto e Infantil','Alergia e Imunologia','Quinta-feira','09:00 às 11:30',NULL,FALSE,1),
('Renato Darcio Camilo Junior','Pediatra e Alergologista','Alergia e Imunologia','Seg a Qui / Sexta / Sábado','09:00 às 12:00 e 14:30 às 17:30 / 16:00 às 18:00 / 09:00 às 12:00','Também listado em Pediatria',FALSE,2),
-- Urologia
('José Murilo Bastos Netto','Urologia Infantil','Urologia','Terça-feira','13:00 às 15:00',NULL,FALSE,1),
-- Ortopedia
('Thalles Bregalda Reis','Ortopedia – Adulto e Infantil / Pediátrico','Ortopedia','Terça-feira','16:00 às 18:20',NULL,FALSE,1),
-- Psicologia
('Luane Viera dos Santos','Psicóloga','Psicologia','Segunda e Quarta / Terça (15 em 15d)','09:00 às 18:00 / 09:00 às 11:00',NULL,FALSE,1),
-- Fonoaudiologia
('Mariana Barbosa de Carvalho','Fonoaudióloga','Fonoaudiologia','Terça-feira','09:00 às 15:30',NULL,FALSE,1),
-- Nutrição
('Regiane Faia','Nutricionista','Nutrição','Sexta-feira / Sábado','14:30 às 17:30 / 09:00 às 11:00',NULL,FALSE,1)
ON CONFLICT DO NOTHING;
