-- 20 · Security: a self-registering user must not be able to name its own role.
--
-- THE HOLE
-- `app.handle_new_user()` read `role`, `school_id` and `municipality_id` straight out
-- of `raw_user_meta_data`. That column is whatever the *client* sent: supabase-js puts
-- the `options.data` of a `signUp()` call there verbatim. With signups enabled, one
-- unauthenticated request —
--
--   POST /auth/v1/signup { email, password,
--                          data: { role: "city_admin", municipality_id: "<seed uuid>" } }
--
-- — minted a municipal admin. No password to guess, no existing account to compromise.
-- That admin reads every school's diagnostic, vision, principal's message and files,
-- and can reset passwords and retire schools. The municipality uuid is a literal in the
-- seed migration, so it was not even a secret.
--
-- THE FIX
-- Take the role from `raw_app_meta_data` instead. GoTrue lets a client write only
-- `user_metadata`; `app_metadata` is settable exclusively through the admin API, which
-- requires the service_role key. So the same statement now says "the server vouched for
-- this role" rather than "the browser asked for this role".
--
-- A signup that names a role therefore produces NO profile at all. That is the intended
-- outcome, not a gap: `app.auth_role()` returns null, and every RLS policy denies. The
-- account exists in auth.users and can reach nothing.
--
-- `display_name` still comes from user_metadata — it is a label, not a permission.
--
-- Belt and braces: this migration only closes the door in the database. Also turn off
-- Authentication → Sign In / Providers → "Allow new users to sign up" in the dashboard,
-- so unauthenticated accounts cannot be created at all.

-- ── Backfill: mirror the role metadata the server already trusts ──────────────
-- Every existing auth user was provisioned server-side (the city admin by migration 14,
-- the schools through api/_lib/admin.ts with the service_role key), so their
-- user_metadata role is trustworthy. Copy it across before the trigger stops reading it,
-- otherwise re-provisioning any of them later would silently produce no profile.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'role',            u.raw_user_meta_data ->> 'role',
        'school_id',       nullif(u.raw_user_meta_data ->> 'school_id', ''),
        'municipality_id', nullif(u.raw_user_meta_data ->> 'municipality_id', '')
      ))
where u.raw_user_meta_data ? 'role'
  and not (coalesce(u.raw_app_meta_data, '{}'::jsonb) ? 'role');

-- ── The trigger now trusts only what the server wrote ─────────────────────────
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- raw_app_meta_data, NOT raw_user_meta_data: the latter is client-supplied.
  if (new.raw_app_meta_data ? 'role') then
    insert into public.profiles (id, role, school_id, municipality_id, display_name)
    values (
      new.id,
      (new.raw_app_meta_data ->> 'role')::public.user_role,
      nullif(new.raw_app_meta_data ->> 'school_id', '')::uuid,
      nullif(new.raw_app_meta_data ->> 'municipality_id', '')::uuid,
      coalesce(new.raw_user_meta_data ->> 'display_name', '')
    );
  end if;
  return new;
end;
$$;

comment on function app.handle_new_user() is
  'Creates the public.profiles row for a new auth user. Reads the role from '
  'raw_app_meta_data, which only the service_role key can write — raw_user_meta_data '
  'is client-supplied and would let a self-registering user declare itself city_admin.';
