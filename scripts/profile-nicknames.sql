-- Přezdívky účtů. Hry dál drží UUID (created_by / voided_by).
-- V UI a v exportu se v danou chvíli ukáže nickname z public.profiles.
--
-- Spustit v Supabase SQL editoru. Opakované spuštění nepřepíše jméno,
-- které už je vyplněné. Nový účet dostane jméno triggerem při vzniku.
-- Výchozí jméno je část e-mailu před zavináčem, bez teček a dalších znaků
-- mimo povolenou sadu. Kolize doplní číslo (jana, jana2).

create or replace function public.nickname_valid(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is not null
    and pg_catalog.char_length(value) between 2 and 24
    and value = pg_catalog.btrim(value)
    and value !~ '[[:space:]]{2}'
    and value ~ '^[0-9A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž_ ]+$';
$$;

create or replace function public.claim_nickname(user_id uuid, email text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  local text := pg_catalog.split_part(coalesce(email, ''), '@', 1);
  base text;
  candidate text;
  suffix text;
  n int := 1;
begin
  base := pg_catalog.regexp_replace(
    local,
    '[^0-9A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž_ ]',
    '',
    'g'
  );
  base := pg_catalog.regexp_replace(pg_catalog.btrim(base), '[[:space:]]+', ' ', 'g');

  if pg_catalog.char_length(base) < 2 then
    base := 'hrac';
  end if;

  if pg_catalog.char_length(base) > 24 then
    base := pg_catalog.regexp_replace(pg_catalog.left(base, 24), '[[:space:]]+$', '');
  end if;

  if pg_catalog.char_length(base) < 2 then
    base := 'hrac';
  end if;

  candidate := base;
  while exists (
    select 1
    from public.profiles as profiles
    where profiles.id is distinct from user_id
      and profiles.nickname is not null
      and pg_catalog.lower(profiles.nickname) = pg_catalog.lower(candidate)
  ) loop
    n := n + 1;
    if n > 1000 then
      raise exception 'Nepodařilo se najít volnou přezdívku pro %', user_id;
    end if;
    suffix := n::text;
    if pg_catalog.char_length(suffix) >= 23 then
      candidate := pg_catalog.left(suffix, 24);
    else
      candidate := pg_catalog.left(base, 24 - pg_catalog.char_length(suffix)) || suffix;
    end if;
    candidate := pg_catalog.regexp_replace(pg_catalog.btrim(candidate), '[[:space:]]+', ' ', 'g');
  end loop;

  if not public.nickname_valid(candidate) then
    raise exception 'Nepodařilo se sestavit přezdívku pro %', user_id;
  end if;

  return candidate;
end;
$$;

alter table public.profiles
  add column if not exists nickname text;

create or replace function public.profiles_fill_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text;
begin
  if new.nickname is not null and pg_catalog.btrim(new.nickname) <> '' then
    return new;
  end if;

  select users.email::text
  into email
  from auth.users as users
  where users.id = new.id;

  new.nickname := public.claim_nickname(new.id, email);
  return new;
end;
$$;

drop trigger if exists profiles_fill_nickname on public.profiles;
create trigger profiles_fill_nickname
  before insert on public.profiles
  for each row
  execute function public.profiles_fill_nickname();

create or replace function public.profiles_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt int;
begin
  for attempt in 1..5 loop
    begin
      insert into public.profiles as profiles (id, nickname)
      values (new.id, public.claim_nickname(new.id, new.email::text))
      on conflict (id) do update
        set nickname = excluded.nickname
        where profiles.nickname is null;
      return new;
    exception
      when unique_violation then
        null;
    end;
  end loop;

  raise exception 'Nepodařilo se uložit přezdívku pro %', new.id;
end;
$$;

drop trigger if exists profiles_for_new_user on auth.users;
create trigger profiles_for_new_user
  after insert on auth.users
  for each row
  execute function public.profiles_for_new_user();

do $$
declare
  account record;
begin
  for account in
    select users.id, users.email::text as email
    from auth.users as users
    order by users.created_at nulls last, users.id
  loop
    insert into public.profiles as profiles (id, nickname)
    values (account.id, public.claim_nickname(account.id, account.email))
    on conflict (id) do update
      set nickname = excluded.nickname
      where profiles.nickname is null;
  end loop;

  for account in
    select profiles.id
    from public.profiles as profiles
    where profiles.nickname is null
  loop
    update public.profiles
    set nickname = public.claim_nickname(account.id, '')
    where id = account.id
      and nickname is null;
  end loop;
end;
$$;

alter table public.profiles
  alter column nickname set not null;

alter table public.profiles
  drop constraint if exists profiles_nickname_valid;

alter table public.profiles
  add constraint profiles_nickname_valid
  check (public.nickname_valid(nickname));

create unique index if not exists profiles_nickname_lower_idx
  on public.profiles (lower(nickname));

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

revoke all on function public.nickname_valid(text) from public, anon;
grant execute on function public.nickname_valid(text) to authenticated, service_role;

revoke all on function public.claim_nickname(uuid, text) from public, anon, authenticated;
revoke all on function public.profiles_fill_nickname() from public, anon;
grant execute on function public.profiles_fill_nickname() to authenticated, service_role;

revoke all on function public.profiles_for_new_user() from public, anon, authenticated;
grant execute on function public.profiles_for_new_user() to supabase_auth_admin, service_role;

revoke all on function public.account_labels() from public, anon;
grant execute on function public.account_labels() to authenticated, service_role;

notify pgrst, 'reload schema';
