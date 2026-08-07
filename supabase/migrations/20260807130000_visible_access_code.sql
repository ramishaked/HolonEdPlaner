-- 18 · The school access code becomes visible to the municipal admin.
--
--   A password in `auth.users` is a one-way bcrypt hash — it can be verified, never
--   read back. The admin console needs to *show* each school its code ("what is my
--   password again?" is the most common call the municipality gets), so the code is
--   kept alongside in plain text on `schools.access_code`.
--
--   This is a deliberate, product-level trade: these are 4-digit codes handed out over
--   the phone to guard a work plan, not credentials protecting personal data. The
--   plain copy is readable by the owning school (its own code) and by its city admin —
--   `schools_select` already scopes exactly that — and the admin console reads it
--   server-side through the service_role route.
--
--   `admin_set_school_password` writes both halves, so the hash and the visible copy
--   cannot drift: there is one way to set a code, and it sets both.

alter table public.schools
  add column if not exists access_code text not null default '';

comment on column public.schools.access_code is
  'Plain-text login code, shown to the municipal admin. Kept in step with auth.users.encrypted_password by admin_set_school_password() — never write one without the other.';

-- ── the single writer ────────────────────────────────────────────────────────
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

  -- The visible copy, written in the same call so the two can never disagree.
  update public.schools
  set access_code = p_password
  where id = p_school_id;

  return true;
end;
$$;

revoke all on function public.admin_set_school_password(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_school_password(uuid, text) to service_role;

-- ── normalise the existing codes ─────────────────────────────────────────────
--   Every school gets 0000; the Hogwarts QA school keeps 9999. Existing codes were
--   provisioned out of band and are unknowable (bcrypt), so this is also what makes
--   the new "show the code" column truthful from day one.
update auth.users u
set encrypted_password = extensions.crypt(
      case when s.name = 'Hogwarts' then '9999' else '0000' end,
      extensions.gen_salt('bf')),
    updated_at = now()
from public.profiles p
join public.schools s on s.id = p.school_id
where u.id = p.id and p.role = 'school';

update public.schools
set access_code = case when name = 'Hogwarts' then '9999' else '0000' end;

-- Fail loudly rather than leave a school whose shown code is not its real one.
do $$
begin
  if exists (select 1 from public.schools where access_code = '') then
    raise exception 'visible access code: % schools left without a code',
      (select count(*) from public.schools where access_code = '');
  end if;
end $$;
