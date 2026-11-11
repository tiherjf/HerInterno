-- Esconde profiles.birth_date de quem acessa pelo navegador (papéis anon e authenticated).
--
-- Sem isto, qualquer colaborador logado podia ler o ano de nascimento de todos os colegas
-- chamando a API REST do Supabase direto, mesmo a tela mostrando só dia/mês.
-- O servidor (service role) continua lendo normalmente: página inicial, /api/perfil e
-- /api/admin/users já usam o service client para essa coluna.
--
-- Como funciona: no Postgres, privilégio de coluna só vale se não houver privilégio de
-- tabela. Então tira o SELECT da tabela inteira e devolve coluna a coluna, menos birth_date.
--
-- ATENÇÃO: uma coluna nova em profiles NÃO fica legível pelo navegador automaticamente.
-- Ao criar uma, inclua um "grant select (nova_coluna) on public.profiles to anon, authenticated;"
-- se ela precisar ser lida pelo app (e atualize PROFILE_PUBLIC_COLUMNS em lib/auth/staff.ts).

revoke select on public.profiles from anon, authenticated;

grant select (
  id, full_name, role, sector, unit, phone_ext, active, created_at,
  is_manager, manager_id, avatar_url
) on public.profiles to anon, authenticated;
