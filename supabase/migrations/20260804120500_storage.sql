-- 06 · Storage: a private bucket for school logos + attachments.
--       Object paths are `{school_id}/...`; policies gate on that leading segment.

insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', false)
on conflict (id) do nothing;

-- A school reads/writes only under its own {school_id}/ prefix.
-- city_admin / super_admin read across their scope for oversight.
create policy school_assets_select on storage.objects for select
  using (
    bucket_id = 'school-assets'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.auth_school_id()::text
      or (public.auth_role() = 'city_admin'
          and exists (select 1 from public.schools s
                      where s.id::text = (storage.foldername(name))[1]
                        and s.municipality_id = public.auth_municipality_id()))
    )
  );

create policy school_assets_insert on storage.objects for insert
  with check (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = public.auth_school_id()::text or public.is_super_admin())
  );

create policy school_assets_update on storage.objects for update
  using (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = public.auth_school_id()::text or public.is_super_admin())
  )
  with check (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = public.auth_school_id()::text or public.is_super_admin())
  );

create policy school_assets_delete on storage.objects for delete
  using (
    bucket_id = 'school-assets'
    and ((storage.foldername(name))[1] = public.auth_school_id()::text or public.is_super_admin())
  );
