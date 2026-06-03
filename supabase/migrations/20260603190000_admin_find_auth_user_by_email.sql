-- admin_find_auth_user_by_email
-- ----------------------------------------------------------------------------
-- Lookup usado pela edge function `admin-create-user` para RECUPERAR um usuário
-- cujo cadastro foi interrompido no meio (auth.users criado, mas vínculos de
-- instância/caixa/departamento não) quando o e-mail já existe. Permite que um
-- novo "Novo Membro" com o mesmo e-mail complete os vínculos faltantes em vez
-- de falhar com "e-mail já existe".
--
-- SECURITY DEFINER porque auth.users NÃO é exposto via PostgREST. Acesso
-- restrito ao service_role (a edge fn usa SERVICE_ROLE_KEY) — nunca anon/auth.
create or replace function public.admin_find_auth_user_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
stable
as $$
  select id
  from auth.users
  where lower(email) = lower(p_email)
  order by created_at asc
  limit 1
$$;

revoke all on function public.admin_find_auth_user_by_email(text) from public;
revoke all on function public.admin_find_auth_user_by_email(text) from anon;
revoke all on function public.admin_find_auth_user_by_email(text) from authenticated;
grant execute on function public.admin_find_auth_user_by_email(text) to service_role;
