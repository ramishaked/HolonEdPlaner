-- 15 · Replace the plan's focus anchors atomically.
--   saveFocus() used to DELETE every row for the plan and then INSERT the new set as
--   two separate requests. Two debounced saves overlapping interleave as
--   A-delete, B-delete, A-insert, B-insert — and B's insert collides with A's rows on
--   unique (plan_id, principle_id, role), surfacing a 409. A bad interleaving can also
--   leave the plan with the older selection.
--
--   Doing both statements inside one function makes them one transaction, and an
--   advisory lock keyed on the plan serialises concurrent callers so the second one
--   sees the first one's committed rows before it deletes. Last writer wins, cleanly.
--
--   SECURITY INVOKER: RLS on plan_focus still applies, so a school can only rewrite
--   the anchors of a plan it owns — exactly as before.

create or replace function public.set_plan_focus(p_plan_id uuid, p_focus jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- serialise per plan; released automatically at transaction end
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));

  delete from public.plan_focus where plan_id = p_plan_id;

  insert into public.plan_focus (plan_id, principle_id, role, position)
  select p_plan_id,
         (e ->> 'principle_id')::uuid,
         e ->> 'role',
         coalesce((e ->> 'position')::int, 0)
  from jsonb_array_elements(coalesce(p_focus, '[]'::jsonb)) e;
end;
$$;

revoke all on function public.set_plan_focus(uuid, jsonb) from public;
grant execute on function public.set_plan_focus(uuid, jsonb) to authenticated;
