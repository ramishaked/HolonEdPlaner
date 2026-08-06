-- 09 · Public school directory for the login picker.
-- The login screen must list schools BEFORE anyone is signed in, but RLS blocks
-- anon reads of `schools`. This SECURITY DEFINER function exposes ONLY the
-- non-sensitive (id, name, municipality) needed to populate the dropdown.
-- Intentionally callable by anon (that is the whole point) — the two advisor
-- notices about an anon-executable SECURITY DEFINER function are expected here.
create or replace function public.list_schools()
returns table (id uuid, name text, municipality_id uuid)
language sql stable security definer set search_path = ''
as $$
  select id, name, municipality_id from public.schools order by name;
$$;

grant execute on function public.list_schools() to anon, authenticated;
