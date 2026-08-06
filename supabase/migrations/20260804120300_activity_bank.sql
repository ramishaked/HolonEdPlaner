-- 04 · Activity bank: admin-curated per municipality, plus school-owned items
--       for a school's custom principles. Reuses the scope helpers from migration 03.

create table public.activity_bank_items (
  id              uuid primary key default gen_random_uuid(),
  scope           public.principle_scope not null,
  municipality_id uuid references public.municipalities(id) on delete cascade,
  school_id       uuid references public.schools(id) on delete cascade,
  principle_id    uuid references public.principles(id) on delete set null,
  slug            text not null default '',
  title           text not null,
  category        text not null default '',      -- internal "type" (drives metric suggestions)
  source          public.task_source not null default 'עירוני',
  short           text not null default '',
  goal            text not null default '',
  audience        text not null default '',
  contact         text not null default '',
  description     text not null default '',
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint activity_bank_scope_ck check (
    (scope = 'municipal' and municipality_id is not null and school_id is null) or
    (scope = 'school'     and school_id is not null)
  )
);
create index activity_bank_municipality_id_idx on public.activity_bank_items (municipality_id);
create index activity_bank_school_id_idx on public.activity_bank_items (school_id);
create index activity_bank_principle_id_idx on public.activity_bank_items (principle_id);

create trigger trg_activity_bank_updated before update on public.activity_bank_items
  for each row execute function public.set_updated_at();

-- ── RLS (same scope model as principles) ─────────────────────────────────────
alter table public.activity_bank_items enable row level security;

create policy activity_bank_select on public.activity_bank_items for select
  using (public.can_read_scoped(scope, municipality_id, school_id));
create policy activity_bank_insert on public.activity_bank_items for insert
  with check (public.can_write_scoped(scope, municipality_id, school_id));
create policy activity_bank_update on public.activity_bank_items for update
  using (public.can_write_scoped(scope, municipality_id, school_id))
  with check (public.can_write_scoped(scope, municipality_id, school_id));
create policy activity_bank_delete on public.activity_bank_items for delete
  using (public.can_write_scoped(scope, municipality_id, school_id));
