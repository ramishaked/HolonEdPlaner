-- 02 · Tenancy: municipalities, schools, school_files, profiles
--       + auth helper functions, signup trigger, and RLS.

-- ── Tables ───────────────────────────────────────────────────────────────────
create table public.municipalities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id                  uuid primary key default gen_random_uuid(),
  municipality_id     uuid not null references public.municipalities(id) on delete restrict,
  name                text not null,
  -- current_plan_id FK is added in migration 05 (plans table does not exist yet).
  current_plan_id     uuid,
  -- business card / onboarding metadata (was SchoolProfile in localStorage):
  principal_name      text not null default '',
  principal_seniority text not null default '',
  student_count       int,
  vision              text not null default '',
  goals               text not null default '',
  uniqueness          text not null default '',
  logo_path           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (municipality_id, name)
);
create index schools_municipality_id_idx on public.schools (municipality_id);

create table public.school_files (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  size_bytes   int  not null,
  mime_type    text not null,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index school_files_school_id_idx on public.school_files (school_id);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            public.user_role not null,
  school_id       uuid references public.schools(id) on delete cascade,
  municipality_id uuid references public.municipalities(id) on delete cascade,
  display_name    text not null default '',
  created_at      timestamptz not null default now(),
  -- Exactly the scoping each role needs, and nothing it doesn't.
  constraint profiles_scope_ck check (
    (role = 'school'      and school_id is not null and municipality_id is null) or
    (role = 'city_admin'  and municipality_id is not null and school_id is null) or
    (role = 'super_admin' and school_id is null and municipality_id is null)
  )
);
create index profiles_school_id_idx on public.profiles (school_id);
create index profiles_municipality_id_idx on public.profiles (municipality_id);

create trigger trg_municipalities_updated before update on public.municipalities
  for each row execute function public.set_updated_at();
create trigger trg_schools_updated before update on public.schools
  for each row execute function public.set_updated_at();

-- ── Auth helper functions (SECURITY DEFINER → bypass RLS, avoid policy recursion) ─
create or replace function public.auth_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.auth_school_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select school_id from public.profiles where id = auth.uid(); $$;

-- For a city_admin: their municipality directly. For a school user: their school's municipality.
create or replace function public.auth_municipality_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    p.municipality_id,
    (select s.municipality_id from public.schools s where s.id = p.school_id)
  )
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false); $$;

-- ── Signup trigger: create a profile from user metadata (admin-driven creation) ──
-- Only fires when the caller set a 'role' in raw_user_meta_data, so no invalid row
-- is ever produced. Super-admin / city-admin bootstrap sets this metadata explicitly.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.raw_user_meta_data ? 'role') then
    insert into public.profiles (id, role, school_id, municipality_id, display_name)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid,
      nullif(new.raw_user_meta_data ->> 'municipality_id', '')::uuid,
      coalesce(new.raw_user_meta_data ->> 'display_name', '')
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.municipalities enable row level security;
alter table public.schools        enable row level security;
alter table public.school_files   enable row level security;
alter table public.profiles       enable row level security;

-- municipalities: readable by anyone scoped to it; only super_admin writes.
create policy municipalities_select on public.municipalities for select
  using (public.is_super_admin() or id = public.auth_municipality_id());
create policy municipalities_super_write on public.municipalities for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- schools: a school reads/updates its own row; city_admin reads all in its municipality;
-- super_admin does everything (school creation is a bootstrap action → super only).
create policy schools_select on public.schools for select
  using (
    public.is_super_admin()
    or id = public.auth_school_id()
    or (public.auth_role() = 'city_admin' and municipality_id = public.auth_municipality_id())
  );
create policy schools_self_update on public.schools for update
  using (id = public.auth_school_id())
  with check (id = public.auth_school_id());
create policy schools_super_write on public.schools for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- school_files: same ownership model as schools.
create policy school_files_select on public.school_files for select
  using (
    public.is_super_admin()
    or school_id = public.auth_school_id()
    or (public.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = school_id and s.municipality_id = public.auth_municipality_id()))
  );
create policy school_files_self_write on public.school_files for all
  using (school_id = public.auth_school_id() or public.is_super_admin())
  with check (school_id = public.auth_school_id() or public.is_super_admin());

-- profiles: a user reads its own; admins read within scope; only super_admin writes
-- (the signup trigger inserts as definer, so no user-facing insert policy is needed).
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (public.auth_role() = 'city_admin' and (
          municipality_id = public.auth_municipality_id()
          or school_id in (select s.id from public.schools s
                           where s.municipality_id = public.auth_municipality_id())))
  );
create policy profiles_super_write on public.profiles for all
  using (public.is_super_admin()) with check (public.is_super_admin());
