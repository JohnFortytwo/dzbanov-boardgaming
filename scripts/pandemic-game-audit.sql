-- Autor zápisu a neplatnost partie.
-- Prázdné voided_at znamená platnou hru. Statistiky berou jen platné partie.
-- Záloha exportuje všechny, včetně neplatných.

alter table public.pandemic_games
  add column if not exists created_by uuid,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;
