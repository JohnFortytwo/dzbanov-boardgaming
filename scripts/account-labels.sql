-- Popisky účtů pro statistiky. auth.users nejde číst přes běžné API:
-- anon klíč dostane na auth admin 403 a aplikace pak ukáže „Neznámý účet“.
-- Funkce běží jako vlastník a vrací jen id a e-mail přihlášeným uživatelům.

create or replace function public.account_labels()
returns table (id uuid, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select users.id, users.email::text
  from auth.users as users
  where users.email is not null
    and pg_catalog.btrim(users.email) <> ''
    and (
      exists (
        select 1
        from public.pandemic_games as games
        where games.created_by = users.id
           or games.voided_by = users.id
      )
    );
$$;

revoke all on function public.account_labels() from public;
revoke all on function public.account_labels() from anon;
grant execute on function public.account_labels() to authenticated;
grant execute on function public.account_labels() to service_role;

notify pgrst, 'reload schema';
