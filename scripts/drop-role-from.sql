-- Výchozí role změny se dopočítá z hráče, role se kterou vstupoval a pořadí změn.
alter table public.pandemic_game_role_changes
  drop column if exists from_role_code;

notify pgrst, 'reload schema';
