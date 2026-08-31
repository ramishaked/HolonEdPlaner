-- 22 · A school could rewrite any column of its own schools row.
--
-- The problem
-- Policy `schools_self_update` is `(id = app.auth_school_id())` with no column
-- restriction, and Postgres RLS cannot limit columns. So a signed-in school, with a
-- crafted PostgREST call (not reachable from the UI), could change columns it must not:
--   • is_active       — disable itself
--   • name            — rename itself in everyone's login picker
--   • municipality_id — vanish from its city admin's lists
--   • access_code     — show the admin a code that no longer signs in
--   • current_plan_id — point at another school's plan (a broken, unhandled state)
-- CLAUDE.md says name/disable go only through api/_lib/admin.ts (service_role); this
-- closes the gap the RLS policy left open.
--
-- The fix
-- A BEFORE UPDATE trigger that, for an end-user caller (JWT role `authenticated`),
-- forces the protected columns back to their stored values. It does NOT widen the
-- trust model: the admin API (service_role) and migrations (no request context) pass
-- through untouched, and RLS still limits the row to the caller's own school. The
-- legitimate school-side writes — business-card fields, logo_path, and a self-owned
-- current_plan_id — are all still allowed.
--
-- Forcing-to-OLD rather than RAISE: a legitimate partial update never sends these
-- columns, so this is a no-op for the app; an attacker's change is silently ignored
-- instead of erroring, and one honest client that happens to echo an unchanged name
-- is not broken.

create or replace function app.lock_school_columns()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  -- The PostgREST role from the JWT: 'authenticated' for a signed-in school,
  -- 'service_role' for the admin API. Empty/absent (migrations, table owner) → null.
  v_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
begin
  -- Only constrain end users. service_role and non-request contexts pass through.
  if v_role is distinct from 'authenticated' then
    return new;
  end if;

  -- Identity and lifecycle columns are owned by the admin path, never the school.
  new.id              := old.id;
  new.name            := old.name;
  new.is_active       := old.is_active;
  new.municipality_id := old.municipality_id;
  new.access_code     := old.access_code;
  new.created_at      := old.created_at;

  -- current_plan_id stays writable (the app sets it), but only to a plan this school
  -- actually owns — never a pointer into another school's plan.
  if new.current_plan_id is distinct from old.current_plan_id
     and new.current_plan_id is not null
     and not app.owns_plan(new.current_plan_id) then
    new.current_plan_id := old.current_plan_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lock_school_columns on public.schools;
create trigger trg_lock_school_columns
before update on public.schools
for each row execute function app.lock_school_columns();
