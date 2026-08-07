-- 19 · Hygiene: give school-scoped principles their own order_index range.
--
-- `principles.order_index` is projected to the app's numeric principle id, and
-- `fetchPrinciples` keys `orderToId` / `shortTitles` by it. That map is shared by the
-- municipal principles and the school's own — so two rows holding the same index means
-- one silently overwrites the other, two principles render with the same id, and an
-- assessment can be written against the wrong principle.
--
-- Nothing forced them apart. Municipal renumbering (`principlesAdmin.renumber`) packs
-- the active set into 1..N and parks retired rows at 90+, deliberately skipping
-- school-scoped rows; `PrinciplesTab` then hands a new municipal principle
-- `max(active municipal index) + 1`. With 5 active municipal principles and one school
-- principle sitting at 6, the next municipal principle would have been created at 6 too.
--
-- Fix: school principles live at 1000+, municipal ones stay below it, and a CHECK keeps
-- it that way. Everything persisted (plan_assessments, plan_focus, plan_principle_plans,
-- activity_bank_item_principles) references `principles.id`, so renumbering is safe.

-- Renumber per school, preserving the existing relative order.
with renumbered as (
  select id,
         999 + row_number() over (partition by school_id order by order_index, created_at, id) as new_index
  from public.principles
  where scope = 'school'
)
update public.principles p
set order_index = r.new_index
from renumbered r
where p.id = r.id
  and p.order_index <> r.new_index;

-- The two ranges must not meet again. 1000 leaves the municipal set the whole 1..999
-- band, which already covers the active run (1..N) and the retired parking spots (90+).
alter table public.principles
  add constraint principles_order_scope_ck check (
    (scope = 'municipal' and order_index between 1 and 999) or
    (scope = 'school'     and order_index >= 1000)
  );

comment on constraint principles_order_scope_ck on public.principles is
  'order_index is projected to the app''s numeric principle id, and municipal + school '
  'principles share that map. Keeping the ranges apart is what stops a school''s own '
  'principle from colliding with the next municipal one.';
