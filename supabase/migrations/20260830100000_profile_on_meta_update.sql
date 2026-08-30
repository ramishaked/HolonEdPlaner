-- 21 · A new school was created without a profile, and rejected every password.
--
-- THE SYMPTOM
-- Adding a school from the "בתי ספר" tab returned 207 "בית הספר נוצר, אך קביעת הסיסמה
-- נכשלה", and left a school that shows up in everyone's login picker and rejects every
-- password. Resetting the password from the list failed for the same reason.
--
-- THE CAUSE
-- `auth.admin.createUser({ app_metadata })` does not write custom app_metadata in the
-- INSERT itself: GoTrue inserts the row with `{"provider":"email","providers":[...]}`
-- and only then UPDATEs the custom fields onto it (27ms apart on the school that
-- exposed this). The `on_auth_user_created` trigger is AFTER INSERT only, so it saw a
-- row without `role`, skipped the profile insert, and `admin_set_school_password()` —
-- which looks the user up through `profiles` — found nothing and returned false.
--
-- The 44 schools seeded on 4.8.2026 are unaffected: their metadata was written in the
-- INSERT itself. Only schools created through the admin console hit this.
--
-- THE FIX
-- A second trigger, on updates to raw_app_meta_data. This does not widen the trust
-- model of migration 20: raw_app_meta_data is still writable only through the admin API
-- with the service_role key, so the statement is still "the server vouched for this
-- role", never "the browser asked for it".
--
-- The insert becomes idempotent (`on conflict do nothing`) because both triggers can
-- fire for the same user. Deliberately not `do update`: changing an existing user's
-- role is not a supported flow, and letting a metadata update rewrite a role would open
-- a new door.

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
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- `update of raw_app_meta_data` limits this to statements that touch that column, and
-- the `when` clause requires the role to actually be there. A plain sign-in updates
-- last_sign_in_at only, so it never fires this.
drop trigger if exists on_auth_user_meta_role on auth.users;
create trigger on_auth_user_meta_role
after update of raw_app_meta_data on auth.users
for each row
when (
  new.raw_app_meta_data ? 'role'
  and old.raw_app_meta_data is distinct from new.raw_app_meta_data
)
execute function app.handle_new_user();

-- Backfill: every user created through the broken path that is still profile-less.
-- A user whose profile already exists (the "פרטי" QA school, repaired by hand) is left
-- untouched.
insert into public.profiles (id, role, school_id, municipality_id, display_name)
select u.id,
       (u.raw_app_meta_data ->> 'role')::public.user_role,
       nullif(u.raw_app_meta_data ->> 'school_id', '')::uuid,
       nullif(u.raw_app_meta_data ->> 'municipality_id', '')::uuid,
       coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
where u.raw_app_meta_data ? 'role'
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

comment on function app.handle_new_user() is
  'Creates the public.profiles row for a new auth user. Reads the role from '
  'raw_app_meta_data, which only the service_role key can write — raw_user_meta_data '
  'is client-supplied and would let a self-registering user declare itself city_admin. '
  'Fires both AFTER INSERT and AFTER UPDATE OF raw_app_meta_data, because '
  'auth.admin.createUser() writes custom app_metadata in a follow-up update.';
