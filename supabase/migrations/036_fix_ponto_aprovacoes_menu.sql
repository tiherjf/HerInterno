-- Remove qualquer entrada duplicada de aprovação de pontos com categoria errada
DELETE FROM menu_permissions
WHERE href = '/intranet/ponto/aprovacoes'
  AND key != 'ponto-aprovacoes';

-- Garante que a entrada correta existe com categoria "Ponto & RH"
INSERT INTO menu_permissions (key, label, href, icon, category, order_num, can_view, can_edit, active)
VALUES (
  'ponto-aprovacoes',
  'Aprovação de Pontos',
  '/intranet/ponto/aprovacoes',
  'CheckSquare',
  'Ponto & RH',
  11,
  ARRAY['admin','ti','rh'],
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
