-- Data de nascimento do colaborador, usada no card de aniversariantes da página inicial.
-- A coluna fica fora do alcance do navegador (ver 049): só o servidor lê, e a página inicial
-- mostra apenas dia e mês.
alter table public.profiles add column if not exists birth_date date;
