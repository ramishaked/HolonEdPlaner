-- 08 · Hardening: move SECURITY DEFINER helper functions out of the API-exposed
--       `public` schema into a private `app` schema (not in PostgREST's exposed
--       schemas), so they can't be called as RPCs. RLS policies are repointed to
--       app.*; the authenticated role still has EXECUTE (granted to public by
--       default), so policy evaluation is unaffected. Clears advisor lints 0028/0029.

create schema if not exists app;

-- ── Helper functions (identical bodies; nested calls now reference app.*) ─────
create or replace function app.auth_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function app.auth_school_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select school_id from public.profiles where id = auth.uid(); $$;

create or replace function app.auth_municipality_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    p.municipality_id,
    (select s.municipality_id from public.schools s where s.id = p.school_id)
  )
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false); $$;

create or replace function app.can_read_scoped(
  p_scope public.principle_scope, p_municipality_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.is_super_admin()
    or (p_scope = 'municipal' and p_municipality_id = app.auth_municipality_id())
    or (p_scope = 'school' and p_school_id = app.auth_school_id())
    or (p_scope = 'school' and app.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = p_school_id and s.municipality_id = app.auth_municipality_id()));
$$;

create or replace function app.can_write_scoped(
  p_scope public.principle_scope, p_municipality_id uuid, p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.is_super_admin()
    or (p_scope = 'municipal' and app.auth_role() = 'city_admin'
        and p_municipality_id = app.auth_municipality_id())
    or (p_scope = 'school' and p_school_id = app.auth_school_id());
$$;

create or replace function app.owns_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and (p.school_id = app.auth_school_id() or app.is_super_admin())
  );
$$;

create or replace function app.can_read_plan(p_plan_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.plans p join public.schools s on s.id = p.school_id
    where p.id = p_plan_id and (
      app.is_super_admin()
      or p.school_id = app.auth_school_id()
      or (app.auth_role() = 'city_admin' and s.municipality_id = app.auth_municipality_id())
    )
  );
$$;

create or replace function app.handle_new_user()
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

-- ── Repoint the signup trigger, then drop the old public function ─────────────
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ── Recreate every RLS policy to reference app.* (drop old, create new) ───────

-- tenancy
drop policy municipalities_select on public.municipalities;
create policy municipalities_select on public.municipalities for select
  using (app.is_super_admin() or id = app.auth_municipality_id());
drop policy municipalities_super_write on public.municipalities;
create policy municipalities_super_write on public.municipalities for all
  using (app.is_super_admin()) with check (app.is_super_admin());

drop policy schools_select on public.schools;
create policy schools_select on public.schools for select
  using (
    app.is_super_admin()
    or id = app.auth_school_id()
    or (app.auth_role() = 'city_admin' and municipality_id = app.auth_municipality_id())
  );
drop policy schools_self_update on public.schools;
create policy schools_self_update on public.schools for update
  using (id = app.auth_school_id()) with check (id = app.auth_school_id());
drop policy schools_super_write on public.schools;
create policy schools_super_write on public.schools for all
  using (app.is_super_admin()) with check (app.is_super_admin());

drop policy school_files_select on public.school_files;
create policy school_files_select on public.school_files for select
  using (
    app.is_super_admin()
    or school_id = app.auth_school_id()
    or (app.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = school_id and s.municipality_id = app.auth_municipality_id()))
  );
drop policy school_files_self_write on public.school_files;
create policy school_files_self_write on public.school_files for all
  using (school_id = app.auth_school_id() or app.is_super_admin())
  with check (school_id = app.auth_school_id() or app.is_super_admin());

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or app.is_super_admin()
    or (app.auth_role() = 'city_admin' and (
          municipality_id = app.auth_municipality_id()
          or school_id in (select s.id from public.schools s
                           where s.municipality_id = app.auth_municipality_id())))
  );
drop policy profiles_super_write on public.profiles;
create policy profiles_super_write on public.profiles for all
  using (app.is_super_admin()) with check (app.is_super_admin());

-- principles
drop policy principles_select on public.principles;
create policy principles_select on public.principles for select
  using (app.can_read_scoped(scope, municipality_id, school_id));
drop policy principles_insert on public.principles;
create policy principles_insert on public.principles for insert
  with check (app.can_write_scoped(scope, municipality_id, school_id));
drop policy principles_update on public.principles;
create policy principles_update on public.principles for update
  using (app.can_write_scoped(scope, municipality_id, school_id))
  with check (app.can_write_scoped(scope, municipality_id, school_id));
drop policy principles_delete on public.principles;
create policy principles_delete on public.principles for delete
  using (app.can_write_scoped(scope, municipality_id, school_id));

drop policy principle_sources_select on public.principle_sources;
create policy principle_sources_select on public.principle_sources for select
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_read_scoped(p.scope, p.municipality_id, p.school_id)));
drop policy principle_sources_write on public.principle_sources;
create policy principle_sources_write on public.principle_sources for all
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_write_scoped(p.scope, p.municipality_id, p.school_id)))
  with check (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_write_scoped(p.scope, p.municipality_id, p.school_id)));

drop policy principle_rubric_levels_select on public.principle_rubric_levels;
create policy principle_rubric_levels_select on public.principle_rubric_levels for select
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_read_scoped(p.scope, p.municipality_id, p.school_id)));
drop policy principle_rubric_levels_write on public.principle_rubric_levels;
create policy principle_rubric_levels_write on public.principle_rubric_levels for all
  using (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_write_scoped(p.scope, p.municipality_id, p.school_id)))
  with check (exists (select 1 from public.principles p
                 where p.id = principle_id
                   and app.can_write_scoped(p.scope, p.municipality_id, p.school_id)));

-- activity bank
drop policy activity_bank_select on public.activity_bank_items;
create policy activity_bank_select on public.activity_bank_items for select
  using (app.can_read_scoped(scope, municipality_id, school_id));
drop policy activity_bank_insert on public.activity_bank_items;
create policy activity_bank_insert on public.activity_bank_items for insert
  with check (app.can_write_scoped(scope, municipality_id, school_id));
drop policy activity_bank_update on public.activity_bank_items;
create policy activity_bank_update on public.activity_bank_items for update
  using (app.can_write_scoped(scope, municipality_id, school_id))
  with check (app.can_write_scoped(scope, municipality_id, school_id));
drop policy activity_bank_delete on public.activity_bank_items;
create policy activity_bank_delete on public.activity_bank_items for delete
  using (app.can_write_scoped(scope, municipality_id, school_id));

-- plans + children
drop policy plans_select on public.plans;
create policy plans_select on public.plans for select
  using (
    app.is_super_admin()
    or school_id = app.auth_school_id()
    or (app.auth_role() = 'city_admin'
        and exists (select 1 from public.schools s
                    where s.id = school_id and s.municipality_id = app.auth_municipality_id()))
  );
drop policy plans_write on public.plans;
create policy plans_write on public.plans for all
  using (school_id = app.auth_school_id() or app.is_super_admin())
  with check (school_id = app.auth_school_id() or app.is_super_admin());

drop policy plan_focus_read on public.plan_focus;
create policy plan_focus_read on public.plan_focus for select using (app.can_read_plan(plan_id));
drop policy plan_focus_write on public.plan_focus;
create policy plan_focus_write on public.plan_focus for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

drop policy plan_assessments_read on public.plan_assessments;
create policy plan_assessments_read on public.plan_assessments for select using (app.can_read_plan(plan_id));
drop policy plan_assessments_write on public.plan_assessments;
create policy plan_assessments_write on public.plan_assessments for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

drop policy plan_principle_plans_read on public.plan_principle_plans;
create policy plan_principle_plans_read on public.plan_principle_plans for select using (app.can_read_plan(plan_id));
drop policy plan_principle_plans_write on public.plan_principle_plans;
create policy plan_principle_plans_write on public.plan_principle_plans for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

drop policy plan_activities_read on public.plan_activities;
create policy plan_activities_read on public.plan_activities for select using (app.can_read_plan(plan_id));
drop policy plan_activities_write on public.plan_activities;
create policy plan_activities_write on public.plan_activities for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

drop policy plan_ai_reports_read on public.plan_ai_reports;
create policy plan_ai_reports_read on public.plan_ai_reports for select using (app.can_read_plan(plan_id));
drop policy plan_ai_reports_write on public.plan_ai_reports;
create policy plan_ai_reports_write on public.plan_ai_reports for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

drop policy plan_export_configs_read on public.plan_export_configs;
create policy plan_export_configs_read on public.plan_export_configs for select using (app.can_read_plan(plan_id));
drop policy plan_export_configs_write on public.plan_export_configs;
create policy plan_export_configs_write on public.plan_export_configs for all
  using (app.owns_plan(plan_id)) with check (app.owns_plan(plan_id));

-- storage
drop policy school_assets_select on storage.objects;
create policy school_assets_select on storage.objects for select
  using (
    bucket_id = 'school-assets'
    and (
      app.is_super_admin()
      or (storage.foldername(name))[1] = app.auth_school_id()::text
      or (app.auth_role() = 'city_admin'
          and exists (select 1 from public.schools s
                      where s.id::text = (storage.foldername(name))[1]
                        and s.municipality_id = app.auth_municipality_id()))
    )
  );
drop policy school_assets_insert on storage.objects;
create policy school_assets_insert on storage.objects for insert
  with check (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = app.auth_school_id()::text or app.is_super_admin())
  );
drop policy school_assets_update on storage.objects;
create policy school_assets_update on storage.objects for update
  using (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = app.auth_school_id()::text or app.is_super_admin())
  )
  with check (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = app.auth_school_id()::text or app.is_super_admin())
  );
drop policy school_assets_delete on storage.objects;
create policy school_assets_delete on storage.objects for delete
  using (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = app.auth_school_id()::text or app.is_super_admin())
  );

-- ── Drop the now-unreferenced public helper functions ────────────────────────
drop function public.auth_role();
drop function public.auth_school_id();
drop function public.auth_municipality_id();
drop function public.is_super_admin();
drop function public.can_read_scoped(public.principle_scope, uuid, uuid);
drop function public.can_write_scoped(public.principle_scope, uuid, uuid);
drop function public.owns_plan(uuid);
drop function public.can_read_plan(uuid);
drop function public.handle_new_user();
