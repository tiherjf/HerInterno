-- Adiciona entrada de menu para o módulo de Qualidade
INSERT INTO menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit, active)
VALUES (
  'qualidade',
  'Qualidade',
  '/intranet/qualidade',
  'ShieldCheck',
  'Qualidade',
  1,
  ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo','manutencao'],
  ARRAY['admin','ti','rh'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  label     = EXCLUDED.label,
  href      = EXCLUDED.href,
  icon      = EXCLUDED.icon,
  category  = EXCLUDED.category,
  order_num = EXCLUDED.order_num,
  can_view  = EXCLUDED.can_view,
  can_edit  = EXCLUDED.can_edit,
  active    = EXCLUDED.active;
