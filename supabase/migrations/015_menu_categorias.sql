-- Reorganização de categorias do menu lateral
-- Ramais: Clínica → Comunicação (é um diretório telefônico, não conteúdo clínico)
UPDATE public.menu_permissions
SET category = 'Comunicação', order_num = 3
WHERE key = 'ramais';

-- Corpo Clínico: mantém em Clínica, ajusta order_num
UPDATE public.menu_permissions
SET order_num = 4
WHERE key = 'corpo-clinico';

-- Ponto & RH: renomeia categoria de "Ponto" para "Ponto & RH"
UPDATE public.menu_permissions
SET category = 'Ponto & RH'
WHERE category = 'Ponto';

-- Calendário: label mais curto
UPDATE public.menu_permissions
SET label = 'Calendário'
WHERE key = 'ponto-calendario';
