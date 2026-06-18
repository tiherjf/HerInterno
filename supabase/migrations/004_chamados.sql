-- ============================================================
-- 004_chamados.sql — Sistema próprio de chamados/tickets
-- ============================================================

CREATE TABLE ticket_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  color       text NOT NULL DEFAULT '#3b82f6',
  sla_hours   integer NOT NULL DEFAULT 24,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE tickets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number            integer GENERATED ALWAYS AS IDENTITY,
  title             text NOT NULL,
  description       text NOT NULL,
  category_id       uuid REFERENCES ticket_categories(id),
  priority          text NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'cancelled')),
  requester_id      uuid REFERENCES profiles(id) NOT NULL,
  requester_name    text NOT NULL,
  requester_sector  text,
  assigned_to       uuid REFERENCES profiles(id),
  sla_deadline      timestamptz,
  first_response_at timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,
  rating            integer CHECK (rating BETWEEN 1 AND 5),
  rating_comment    text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE ticket_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  author_id   uuid REFERENCES profiles(id) NOT NULL,
  author_name text NOT NULL,
  content     text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE ticket_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_size   integer,
  created_at  timestamptz DEFAULT now()
);

-- Índices para performance nos relatórios ONA
CREATE INDEX idx_tickets_status        ON tickets(status);
CREATE INDEX idx_tickets_priority      ON tickets(priority);
CREATE INDEX idx_tickets_category      ON tickets(category_id);
CREATE INDEX idx_tickets_requester     ON tickets(requester_id);
CREATE INDEX idx_tickets_assigned      ON tickets(assigned_to);
CREATE INDEX idx_tickets_created       ON tickets(created_at);
CREATE INDEX idx_tickets_sector        ON tickets(requester_sector);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_timestamp();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ticket_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments  ENABLE ROW LEVEL SECURITY;

-- Categorias: qualquer autenticado lê; só admin/ti escreve
CREATE POLICY "ticket_categories_read"  ON ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_categories_write" ON ticket_categories FOR ALL    TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti')));

-- Tickets: requester vê os próprios; agents (ti/admin/rh) veem todos
CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated
  USING (requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh')));

CREATE POLICY "tickets_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());

CREATE POLICY "tickets_update" ON tickets FOR UPDATE TO authenticated
  USING (requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh')));

-- Comentários: requester vê comentários públicos + os próprios internos; agents veem todos
CREATE POLICY "ticket_comments_select" ON ticket_comments FOR SELECT TO authenticated
  USING (
    NOT is_internal
    OR author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh'))
  );
CREATE POLICY "ticket_comments_insert" ON ticket_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Attachments: mesma lógica do ticket
CREATE POLICY "ticket_attachments_select" ON ticket_attachments FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ti','rh')));
CREATE POLICY "ticket_attachments_insert" ON ticket_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- ============================================================
-- Categorias padrão (hospital)
-- ============================================================
INSERT INTO ticket_categories (name, color, sla_hours) VALUES
  ('TI / Suporte',                 '#3b82f6', 4),
  ('TI / Infraestrutura',          '#6366f1', 8),
  ('Manutenção Predial',           '#f59e0b', 24),
  ('Manutenção de Equipamentos',   '#f97316', 8),
  ('RH / Solicitações',            '#10b981', 48),
  ('Almoxarifado',                 '#8b5cf6', 24),
  ('Nutrição e Dieta',             '#ec4899', 4),
  ('Outros',                       '#6b7280', 48);
