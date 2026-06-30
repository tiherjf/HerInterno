-- Remove o item genérico de chamados e adiciona os 3 específicos
UPDATE public.menu_permissions SET active = false WHERE key = 'chamados';

INSERT INTO public.menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit, active)
VALUES
  (
    'chamados-ti',
    'Chamados TI',
    '/intranet/chamados/ti',
    'Monitor',
    'Suporte',
    8,
    ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo','manutencao'],
    ARRAY['admin','ti'],
    true
  ),
  (
    'chamados-manutencao',
    'Chamados Manutenção',
    '/intranet/chamados/manutencao',
    'Wrench',
    'Suporte',
    9,
    ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo','manutencao'],
    ARRAY['admin','manutencao'],
    true
  ),
  (
    'chamados-mkt',
    'Solicitações MKT',
    '/intranet/chamados/marketing',
    'Megaphone',
    'Suporte',
    10,
    ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo','manutencao'],
    ARRAY['admin','marketing'],
    true
  )
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  href = EXCLUDED.href,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  order_num = EXCLUDED.order_num,
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
  active = EXCLUDED.active;
