-- 14 · A real city_admin account behind the Settings "מנהל המערכת" password.
--   The admin wizard writes MUNICIPAL activities (visible to every school), which RLS
--   only grants to a city_admin. Rather than a UI-only password stub, the entered
--   password IS this account's credential: unlocking the screen signs in as it on a
--   separate Supabase client, so the school's own session is untouched.
--   Token columns must be '' (not NULL) or GoTrue 500s on login — known gotcha.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@holon.test',
  extensions.crypt('9999', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'role', 'city_admin',
    'municipality_id', (select id::text from public.municipalities where slug = 'holon'),
    'display_name', 'מנהל/ת מערכת — חולון'
  ),
  now(), now(), '', '', '', '', '', '', '', ''
where not exists (select 1 from auth.users where email = 'admin@holon.test');

-- the profile itself is created by the app.handle_new_user() signup trigger
do $$
begin
  if not exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where u.email = 'admin@holon.test' and p.role = 'city_admin'
  ) then
    raise exception 'city_admin profile was not created by the signup trigger';
  end if;
end $$;
