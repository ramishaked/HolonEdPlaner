-- 16 · School administration from the municipal console.
--
--   Adding, retiring and re-opening a school, and resetting its password, cannot be
--   done from the browser: `schools` is super_admin-only for insert/delete, and the
--   login itself lives in `auth.users`, which PostgREST does not expose at all. Those
--   operations go through a server route holding the service_role key
--   (api/_lib/admin.ts). This migration adds what that route needs.
--
--   A school is never deleted. `plans`, `plan_*`, `school_files` and `profiles` all
--   cascade from `schools`, so a DELETE would erase a year of that school's work.
--   Retiring is `is_active = false` plus a GoTrue ban on its login.

-- ── retire / re-open ─────────────────────────────────────────────────────────
alter table public.schools
  add column if not exists is_active boolean not null default true;

-- The login picker must not offer a retired school. (The ban on its auth user is
-- what actually blocks the login; this only keeps the list honest.)
create or replace function public.list_schools()
returns table (id uuid, name text, municipality_id uuid)
language sql stable security definer set search_path = ''
as $$
  select id, name, municipality_id
  from public.schools
  where is_active
  order by name;
$$;

grant execute on function public.list_schools() to anon, authenticated;

-- ── password: the app owns the rule, not GoTrue ──────────────────────────────
--   The 44 existing logins carry short codes a principal can be told over the phone.
--   GoTrue's admin API enforces its own minimum length and would reject them, so the
--   server sets the hash directly through this function. Row creation still goes
--   through GoTrue (`auth.admin.createUser`), which is where the fiddly internal
--   columns are — this only ever touches `encrypted_password`.
--
--   SECURITY DEFINER + granted to service_role ONLY. If `authenticated` could execute
--   it, any signed-in school could take over another school's login.
create or replace function public.admin_set_school_password(
  p_school_id uuid,
  p_password  text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_password is null or length(p_password) < 4 then
    raise exception 'password too short';
  end if;

  -- Deliberately scoped to school logins: this function must not be a way to
  -- rewrite a city_admin's or super_admin's password.
  select p.id into v_user_id
  from public.profiles p
  where p.school_id = p_school_id and p.role = 'school'
  limit 1;

  if v_user_id is null then
    return false;
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_user_id;

  return true;
end;
$$;

revoke all on function public.admin_set_school_password(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_school_password(uuid, text) to service_role;

-- ── account state for the admin list ─────────────────────────────────────────
--   "when did this school last sign in" and "is its login blocked" live in
--   auth.users. Same rule: service_role only.
create or replace function public.admin_school_accounts(p_municipality_id uuid)
returns table (
  school_id       uuid,
  user_id         uuid,
  last_sign_in_at timestamptz,
  banned_until    timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.school_id, u.id, u.last_sign_in_at, u.banned_until
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.schools s on s.id = p.school_id
  where p.role = 'school' and s.municipality_id = p_municipality_id;
$$;

revoke all on function public.admin_school_accounts(uuid) from public, anon, authenticated;
grant execute on function public.admin_school_accounts(uuid) to service_role;
