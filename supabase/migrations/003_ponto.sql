-- ============================================================
-- SISTEMA DE JUSTIFICATIVA DE PONTO
-- ============================================================

-- Campo gestor nos perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_manager boolean DEFAULT false;

-- Tipos de justificativa (configurável pelo RH)
CREATE TABLE IF NOT EXISTS justification_types (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  description text,
  requires_document  boolean DEFAULT false,
  allows_partial_day boolean DEFAULT true,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO justification_types (name, requires_document, allows_partial_day) VALUES
  ('Atraso',                    false, true),
  ('Falta',                     false, false),
  ('Saída Antecipada',          false, true),
  ('Atestado Médico',           true,  false),
  ('Licença',                   true,  false),
  ('Hora Extra Não Registrada', false, true)
ON CONFLICT (name) DO NOTHING;

-- Justificativas
CREATE TABLE IF NOT EXISTS justifications (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) NOT NULL,
  type_id          uuid REFERENCES justification_types(id) NOT NULL,
  occurrence_date  date NOT NULL,
  is_full_day      boolean DEFAULT true,
  start_time       time,
  end_time         time,
  description      text NOT NULL,
  document_url     text,
  deadline         date NOT NULL,
  status           text DEFAULT 'pending'
    CHECK (status IN ('pending','manager_approved','manager_rejected','approved','rejected')),
  -- Aprovação do gestor
  manager_id            uuid REFERENCES profiles(id),
  manager_observation   text,
  manager_reviewed_at   timestamptz,
  -- Aprovação final do RH
  rh_id                 uuid REFERENCES profiles(id),
  rh_observation        text,
  rh_reviewed_at        timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Banco de horas (saldo mensal — input pelo RH)
CREATE TABLE IF NOT EXISTS hour_bank (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) NOT NULL,
  reference_month  date NOT NULL,   -- primeiro dia do mês
  overtime_minutes int  DEFAULT 0,  -- positivo = crédito, negativo = débito
  description      text,
  updated_by       uuid REFERENCES profiles(id),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, reference_month)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_justif_user   ON justifications(user_id);
CREATE INDEX IF NOT EXISTS idx_justif_status ON justifications(status);
CREATE INDEX IF NOT EXISTS idx_justif_date   ON justifications(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_hbank_user    ON hour_bank(user_id, reference_month);

-- RLS
ALTER TABLE justification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE justifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank           ENABLE ROW LEVEL SECURITY;

-- Tipos: leitura por todos, escrita por admin/rh/ti
CREATE POLICY "jt_read"   ON justification_types FOR SELECT USING (true);
CREATE POLICY "jt_manage" ON justification_types FOR ALL   USING (get_user_role() IN ('admin','ti','rh'));

-- Justificativas: ver as próprias OU ser admin/rh/ti
CREATE POLICY "j_read_own" ON justifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "j_read_rh"  ON justifications FOR SELECT USING (get_user_role() IN ('admin','ti','rh'));
CREATE POLICY "j_insert"   ON justifications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "j_update"   ON justifications FOR UPDATE USING (get_user_role() IN ('admin','ti','rh'));

-- Banco de horas
CREATE POLICY "hb_read_own" ON hour_bank FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "hb_read_rh"  ON hour_bank FOR SELECT USING (get_user_role() IN ('admin','ti','rh'));
CREATE POLICY "hb_manage"   ON hour_bank FOR ALL   USING (get_user_role() IN ('admin','ti','rh'));
