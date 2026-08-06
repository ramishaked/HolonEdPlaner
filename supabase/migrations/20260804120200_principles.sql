-- 03 · Dynamic principles: principles, principle_sources, principle_rubric_levels
--       + generic scope helpers (reused by the activity bank in migration 04) + RLS.

-- ── Scope helpers (municipal rows belong to a municipality; school rows to a school) ─
-- Read: municipal → anyone in that municipality; school → owning school, plus its
--       city_admin for oversight; super_admin always.
create or replace function public.can_read_scoped(
  p_scope public.principle_scope, p_municipality_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin()
    or (p_scope = 'municipal' and p_municipality_id = public.auth_municipality_id())
    or (p_scope = 'school' and p_school_id = public.auth_school_id())
    or (p_scope = 'school' and public.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = p_school_id and s.municipality_id = public.auth_municipality_id()));
$$;

-- Write: municipal → the municipality's city_admin; school → the owning school; super always.
create or replace function public.can_write_scoped(
  p_scope public.principle_scope, p_municipality_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin()
    or (p_scope = 'municipal' and public.auth_role() = 'city_admin'
        and p_municipality_id = public.auth_municipality_id())
    or (p_scope = 'school' and p_school_id = public.auth_school_id());
$$;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table public.principles (
  id                      uuid primary key default gen_random_uuid(),
  scope                   public.principle_scope not null,
  municipality_id         uuid references public.municipalities(id) on delete cascade,
  school_id               uuid references public.schools(id) on delete cascade,
  order_index             int  not null default 0,
  short_label             text not null default '',   -- for the radar chart
  title                   text not null,
  icon                    text not null default '',
  color_name              text not null default '',
  accent_color            text not null default '',
  bg_light                text not null default '',
  text_dark               text not null default '',
  short_summary           text not null default '',
  rationale               text not null default '',
  gaps_solved             text[] not null default '{}',
  added_value             text not null default '',
  implementation_strategy text[] not null default '{}',
  sacrifices_required     text not null default '',
  ecosystem_partnerships  text not null default '',
  kpis                    text[] not null default '{}',
  teacher_deliverable     text not null default '',
  student_deliverable     text not null default '',
  first_step              text not null default '',
  is_active               boolean not null default true,
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- A principle is scoped to exactly one owner, matching its scope.
  constraint principles_scope_ck check (
    (scope = 'municipal' and municipality_id is not null and school_id is null) or
    (scope = 'school'     and school_id is not null)
  )
);
create index principles_municipality_id_idx on public.principles (municipality_id);
create index principles_school_id_idx on public.principles (school_id);

create table public.principle_sources (
  id           uuid primary key default gen_random_uuid(),
  principle_id uuid not null references public.principles(id) on delete cascade,
  title        text not null default '',
  description  text not null default '',
  url          text not null default '',
  keywords     text not null default '',
  order_index  int  not null default 0
);
create index principle_sources_principle_id_idx on public.principle_sources (principle_id);

create table public.principle_rubric_levels (
  id           uuid primary key default gen_random_uuid(),
  principle_id uuid not null references public.principles(id) on delete cascade,
  level        int  not null check (level between 1 and 4),
  name         text not null default '',
  description  text not null default '',
  unique (principle_id, level)
);

create trigger trg_principles_updated before update on public.principles
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.principles             enable row level security;
alter table public.principle_sources      enable row level security;
alter table public.principle_rubric_levels enable row level security;

-- principles: read/write governed by the scope helpers.
create policy principles_select on public.principles for select
  using (public.can_read_scoped(scope, municipality_id, school_id));
create policy principles_insert on public.principles for insert
  with check (public.can_write_scoped(scope, municipality_id, school_id));
create policy principles_update on public.principles for update
  using (public.can_write_scoped(scope, municipality_id, school_id))
  with check (public.can_write_scoped(scope, municipality_id, school_id));
create policy principles_delete on public.principles for delete
  using (public.can_write_scoped(scope, municipality_id, school_id));

-- child tables resolve their scope via the parent principle.
create policy principle_sources_select on public.principle_sources for select
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_read_scoped(p.scope, p.municipality_id, p.school_id)));
create policy principle_sources_write on public.principle_sources for all
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_write_scoped(p.scope, p.municipality_id, p.school_id)))
  with check (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_write_scoped(p.scope, p.municipality_id, p.school_id)));

create policy principle_rubric_levels_select on public.principle_rubric_levels for select
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_read_scoped(p.scope, p.municipality_id, p.school_id)));
create policy principle_rubric_levels_write on public.principle_rubric_levels for all
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_write_scoped(p.scope, p.municipality_id, p.school_id)))
  with check (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and public.can_write_scoped(p.scope, p.municipality_id, p.school_id)));
