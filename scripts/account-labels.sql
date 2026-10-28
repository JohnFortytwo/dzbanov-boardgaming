-- Popisky účtů pro statistiky a export. Vrací přezdívku, nikdy e-mail.
-- Vyžaduje sloupec public.profiles.nickname (scripts/profile-nicknames.sql).

create or replace function public.account_labels()
returns table (id uuid, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.id, profiles.nickname
  from public.profiles as profiles
  where profiles.nickname is not null
    and pg_catalog.btrim(profiles.nickname) <> ''
    and exists (
      select 1
      from public.pandemic_games as games
      where games.created_by = profiles.id
         or games.voided_by = profiles.id
    );
$$;

revoke all on function public.account_labels() from public;
revoke all on function public.account_labels() from anon;
grant execute on function public.account_labels() to authenticated;
grant execute on function public.account_labels() to service_role;

notify pgrst, 'reload schema';
