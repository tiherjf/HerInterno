-- ============================================================
-- 005_ponto_extras.sql — Fechamento mensal, histórico de edições
-- ============================================================

-- Controle de fechamento de períodos pelo RH
CREATE TABLE ponto_fechamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_month text NOT NULL UNIQUE, -- 'YYYY-MM'
  closed_by       uuid REFERENCES profiles(id),
  closed_by_name  text NOT NULL,
  notes           text,
  closed_at       timestamptz DEFAULT now()
);

-- Histórico de auditoria de cada justificativa
CREATE TABLE justification_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  justification_id  uuid REFERENCES justifications(id) ON DELETE CASCADE NOT NULL,
  actor_id          uuid REFERENCES profiles(id),
  actor_name        text NOT NULL,
  action            text NOT NULL,
  -- created | manager_approved | manager_rejected | rh_approved | rh_rejected | cancelled
  previous_status   text,
  new_status        text NOT NULL,
  observation       text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_justification_history_jid ON justification_history(justification_id);
CREATE INDEX idx_ponto_fechamentos_month   ON ponto_fechamentos(reference_month);

-- RLS
ALTER TABLE ponto_fechamentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE justification_history ENABLE ROW LEVEL SECURITY;

-- Fechamentos: todos leem, RH/admin/ti escreve
CREATE POLICY "fechamentos_read"  ON ponto_fechamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fechamentos_write" ON ponto_fechamentos FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh')));

-- Histórico: dono vê o próprio; gestores e RH veem todos
CREATE POLICY "history_select" ON justification_history FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM justifications WHERE id = justification_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_manager = true)
  );
CREATE POLICY "history_insert" ON justification_history FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
