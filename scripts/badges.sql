-- Odznaky: jeden sloupec pro všechny současné i budoucí odznaky.
-- Spustit jednou v Supabase SQL editoru. Staré sloupce has_achievement_* zůstanou
-- a při prvním čtení se do pole přenesou.

alter table public.profiles
  add column if not exists badges text[] not null default '{}';

update public.profiles as profile
set badges = (
  select coalesce(array_agg(distinct badge), '{}'::text[])
  from (
    select unnest(profile.badges) as badge
    union all
    select 'dd_resist'::text where profile.has_achievement_42
    union all
    select 'dd_ano'::text where profile.has_achievement_ano
  ) as earned
  where badge is not null and badge <> ''
);
