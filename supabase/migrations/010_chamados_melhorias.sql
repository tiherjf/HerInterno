-- Histórico automático de mudanças de chamado
CREATE TABLE IF NOT EXISTS public.ticket_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name  TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,  -- status_changed | assigned | unassigned | reopened | priority_changed
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON public.ticket_history(ticket_id);
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

-- Agentes veem todo o histórico
CREATE POLICY "ticket_history_agent_select" ON public.ticket_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
            AND role IN ('admin','ti','rh','manutencao') AND active = TRUE)
  );
-- Solicitante vê apenas status_changed e reopened do próprio ticket
CREATE POLICY "ticket_history_requester_select" ON public.ticket_history
  FOR SELECT USING (
    action IN ('status_changed','reopened') AND
    EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_history.ticket_id AND requester_id = auth.uid())
  );
CREATE POLICY "ticket_history_insert" ON public.ticket_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
            AND role IN ('admin','ti','rh','manutencao') AND active = TRUE)
  );

-- Templates de resposta por equipe
CREATE TABLE IF NOT EXISTS public.ticket_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  team       TEXT NOT NULL DEFAULT 'ti' CHECK (team IN ('ti','manutencao')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ticket_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_templates_manage" ON public.ticket_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
            AND role IN ('admin','ti','manutencao') AND active = TRUE)
  );

-- Checklist por chamado
CREATE TABLE IF NOT EXISTS public.ticket_checklist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  order_num    INTEGER NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_checklist_ticket ON public.ticket_checklist(ticket_id);
ALTER TABLE public.ticket_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_checklist_manage" ON public.ticket_checklist
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
            AND role IN ('admin','ti','manutencao') AND active = TRUE)
  );

-- Templates padrão TI
INSERT INTO public.ticket_templates (name, content, team) VALUES
('Em análise', 'Recebemos seu chamado e estamos analisando o problema. Em breve retornaremos com uma atualização.', 'ti'),
('Aguardando peça', 'O atendimento está aguardando a chegada de peça/equipamento necessário. Assim que chegar, daremos continuidade ao atendimento.', 'ti'),
('Resolvido remotamente', 'O problema foi identificado e resolvido remotamente. Por favor, confirme se está tudo funcionando corretamente.', 'ti'),
('Visita técnica agendada', 'Agendamos uma visita técnica presencial. Entraremos em contato para confirmar data e horário.', 'ti'),
('Aguardando retorno', 'Precisamos de mais informações para dar continuidade ao atendimento. Por favor, responda este chamado com os dados solicitados.', 'ti')
ON CONFLICT DO NOTHING;

-- Templates padrão Manutenção
INSERT INTO public.ticket_templates (name, content, team) VALUES
('Aguardando material', 'O serviço está aguardando a chegada do material necessário para execução.', 'manutencao'),
('Execução agendada', 'O serviço foi agendado. Entraremos em contato para confirmar data e horário de execução.', 'manutencao'),
('Executado com sucesso', 'O serviço foi executado com sucesso. Por favor, confirme se está tudo em ordem.', 'manutencao'),
('Em verificação no local', 'Estamos verificando a situação in loco. Assim que tivermos um diagnóstico, atualizaremos o chamado.', 'manutencao')
ON CONFLICT DO NOTHING;
