-- Jednorázově smaže všem dosavadní odznaky a sloupec badges změní
-- z pole názvů na mapu { "id-odznaku": "čas získání" }.
-- Spustit jednou v Supabase SQL editoru. Opakované spuštění znovu smaže odznaky.

update public.profiles
set
  has_achievement_42 = false,
  has_achievement_ano = false;

alter table public.profiles
  drop column if exists badges;

alter table public.profiles
  add column badges jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
