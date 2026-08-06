-- 05 · Plans — the named, versioned work-plan aggregate (incl. its mapping).
--       plans + focus anchors + assessments + principle-plans + activities
--       + ai report + export config. All owned by one school.

create table public.plans (
  id                       uuid primary key default gen_random_uuid(),
  school_id                uuid not null references public.schools(id) on delete cascade,
  name                     text not null,
  school_year              text not null default '',
  status                   public.plan_status not null default 'draft',
  organizational_sacrifice text not null default '',
  strength_reason          text not null default '',
  breakthrough_reason1     text not null default '',
  breakthrough_reason2     text not null default '',
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (school_id, name)
);
create index plans_school_id_idx on public.plans (school_id);

-- schools.current_plan_id points at the loaded version (FK deferred until now).
alter table public.schools
  add constraint schools_current_plan_fk
  foreign key (current_plan_id) references public.plans(id) on delete set null;

-- Strength / breakthrough anchors (was ActionPlan.strengths[] / breakthroughs[]).
create table public.plan_focus (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans(id) on delete cascade,
  principle_id uuid not null references public.principles(id) on delete cascade,
  role         text not null check (role in ('strength', 'breakthrough')),
  position     int  not null default 0,
  unique (plan_id, principle_id, role)
);
create index plan_focus_plan_id_idx on public.plan_focus (plan_id);

-- THE MAPPING — the self-assessment, one row per (version, principle).
create table public.plan_assessments (
  id                     uuid primary key default gen_random_uuid(),
  plan_id                uuid not null references public.plans(id) on delete cascade,
  principle_id           uuid not null references public.principles(id) on delete cascade,
  why_score              int not null default 1 check (why_score between 1 and 4),
  how_score              int not null default 1 check (how_score between 1 and 4),
  what_score             int not null default 1 check (what_score between 1 and 4),
  selected_maturity_level int not null default 1 check (selected_maturity_level between 1 and 4),
  evidence               text not null default '',
  unique (plan_id, principle_id)
);
create index plan_assessments_plan_id_idx on public.plan_assessments (plan_id);

create table public.plan_principle_plans (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.plans(id) on delete cascade,
  principle_id   uuid not null references public.principles(id) on delete cascade,
  victory_vision text not null default '',
  unique (plan_id, principle_id)
);
create index plan_principle_plans_plan_id_idx on public.plan_principle_plans (plan_id);

create table public.plan_activities (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.plans(id) on delete cascade,
  principle_id uuid not null references public.principles(id) on delete cascade,
  title        text not null default '',
  description  text not null default '',
  metrics      text not null default '',
  target       public.activity_target not null default 'all',
  owner        text not null default '',
  priority     public.activity_priority not null default 'medium',
  category     text not null default '',
  source       public.task_source,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index plan_activities_plan_id_idx on public.plan_activities (plan_id);

create table public.plan_ai_reports (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null unique references public.plans(id) on delete cascade,
  summary_html text not null default '',
  quick_tips   text[] not null default '{}',
  auto_fill    jsonb not null default '{}',
  model        text not null default '',
  generated_at timestamptz not null default now()
);

create table public.plan_export_configs (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null unique references public.plans(id) on delete cascade,
  sections          jsonb not null default '{}',
  principal_message text not null default '',
  vision_text       text not null default ''
);

create trigger trg_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

-- ── Plan-scoped access helpers ───────────────────────────────────────────────
-- owns_plan: the plan's own school (write). can_read_plan: adds city_admin oversight.
create or replace function public.owns_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and (p.school_id = public.auth_school_id() or public.is_super_admin())
  );
$$;

create or replace function public.can_read_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.plans p join public.schools s on s.id = p.school_id
    where p.id = p_plan_id and (
      public.is_super_admin()
      or p.school_id = public.auth_school_id()
      or (public.auth_role() = 'city_admin' and s.municipality_id = public.auth_municipality_id())
    )
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.plans                enable row level security;
alter table public.plan_focus           enable row level security;
alter table public.plan_assessments     enable row level security;
alter table public.plan_principle_plans enable row level security;
alter table public.plan_activities      enable row level security;
alter table public.plan_ai_reports      enable row level security;
alter table public.plan_export_configs  enable row level security;

-- plans: owning school reads/writes; city_admin reads within municipality.
create policy plans_select on public.plans for select
  using (
    public.is_super_admin()
    or school_id = public.auth_school_id()
    or (public.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = school_id and s.municipality_id = public.auth_municipality_id()))
  );
create policy plans_write on public.plans for all
  using (school_id = public.auth_school_id() or public.is_super_admin())
  with check (school_id = public.auth_school_id() or public.is_super_admin());

-- child tables: read via can_read_plan (owner + admin oversight), write via owns_plan (owner only).
create policy plan_focus_read on public.plan_focus for select using (public.can_read_plan(plan_id));
create policy plan_focus_write on public.plan_focus for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

create policy plan_assessments_read on public.plan_assessments for select using (public.can_read_plan(plan_id));
create policy plan_assessments_write on public.plan_assessments for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

create policy plan_principle_plans_read on public.plan_principle_plans for select using (public.can_read_plan(plan_id));
create policy plan_principle_plans_write on public.plan_principle_plans for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

create policy plan_activities_read on public.plan_activities for select using (public.can_read_plan(plan_id));
create policy plan_activities_write on public.plan_activities for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

create policy plan_ai_reports_read on public.plan_ai_reports for select using (public.can_read_plan(plan_id));
create policy plan_ai_reports_write on public.plan_ai_reports for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

create policy plan_export_configs_read on public.plan_export_configs for select using (public.can_read_plan(plan_id));
create policy plan_export_configs_write on public.plan_export_configs for all
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));
