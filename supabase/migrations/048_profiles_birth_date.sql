-- Data de nascimento do colaborador, usada no card de aniversariantes da página inicial.
-- Só dia e mês aparecem para os colegas; o ano fica guardado apenas no perfil.
alter table public.profiles add column if not exists birth_date date;
