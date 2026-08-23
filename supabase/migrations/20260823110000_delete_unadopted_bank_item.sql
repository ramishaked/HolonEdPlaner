-- Hard delete for a bank activity that no school has adopted.
--
-- The bank has deliberately had no delete (see CLAUDE.md): `plan_activities.bank_key`
-- is text without a FK, so deleting an adopted item would orphan the adoption rows and
-- silently drop them from the municipal dashboard. That argument does not hold for an
-- item nobody took — typically a mistaken or duplicate import — where hiding only
-- leaves clutter the admin can never clear.
--
-- The adoption check and the delete run in ONE statement so a school adopting between
-- "check" and "delete" cannot slip through. Security definer because plan_activities
-- is read through app.can_read_plan; the caller's own write permission on the row is
-- re-checked explicitly via app.can_write_scoped, so RLS is not bypassed in spirit.
create or replace function public.delete_unadopted_bank_item(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.activity_bank_items i
   where i.id = p_id
     and i.scope = 'municipal'
     and app.can_write_scoped(i.scope, i.municipality_id, i.school_id)
     and not exists (
       select 1 from public.plan_activities a where a.bank_key = p_id::text
     );
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.delete_unadopted_bank_item(uuid) from public;
grant execute on function public.delete_unadopted_bank_item(uuid) to authenticated;
