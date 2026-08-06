-- 01 · Enums + shared trigger
-- HolonEdPlaner Phase 2 schema. See .claude/plans for the design rationale.
-- All comments/labels are intentionally minimal; Hebrew content lives in the seed migration.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.user_role        as enum ('school', 'city_admin', 'super_admin');
create type public.principle_scope  as enum ('municipal', 'school');
create type public.plan_status      as enum ('draft', 'active', 'archived');
create type public.activity_target  as enum ('all', 'layers', 'teachers');
create type public.activity_priority as enum ('high', 'medium', 'low');
-- task_source keeps the exact Hebrew labels used across the app; color meta stays client-side.
create type public.task_source      as enum ('עירוני', 'בית ספרי', 'משרד החינוך', 'ארצי', 'עולמי');

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
