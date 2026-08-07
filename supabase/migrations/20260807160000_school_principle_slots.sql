-- 20 · A school gets exactly two principle slots, enforced by the schema.
--
-- Migration 19 gave school-scoped principles the band 1000+ so they can never collide
-- with the municipal 1..999 band. It left two holes that only mattered once a principal
-- could actually create one from the UI:
--
--   (a) Nothing stopped two of a school's own principles from sharing one order_index.
--       `fetchPrinciples` keys `orderToId` / `shortTitles` by order_index, so the second
--       row silently overwrites the first: one principle disappears from every screen,
--       and an assessment can be written against the wrong uuid. Exactly the failure 19
--       fixed *across* scopes, still wide open *within* a scope.
--   (b) Nothing capped how many a school could create. The product rule is two.
--
-- Both are one invariant once the band is modelled as slots rather than a sequence: a
-- school principle lives at 1000 or 1001, and (school_id, order_index) is unique. Two
-- slots, at most two rows — enforced by a unique index, which is the only cap that
-- survives two browser tabs saving in the same millisecond. A counting trigger cannot:
-- each transaction counts before the other commits, both see one row, both insert. The
-- count is not stored anywhere, so there is nothing to lock; the index tuple is the lock.
--
-- Deliberately NOT conditioned on is_active. A school does not hide its own principle --
-- the UI offers create / edit / delete. An inactive row would be a row nobody can see and
-- nobody can remove, silently holding a slot. Slots are freed by deleting, and
-- `nextSchoolSlot` in principlesAdmin allocates the lowest free one, so delete-then-create
-- reuses 1000 instead of drifting out of the band.
--
-- Why hard delete is acceptable here while a municipal principle may only be hidden:
-- everything that cascades off principles(id) -- plan_focus, plan_assessments,
-- plan_principle_plans, plan_activities -- belongs to a plan of the very school that owns
-- the principle. The blast radius is the deleter's own data, and the confirm dialog names
-- it. A municipal principle would take every school's work with it; that rule stands.

-- Refuse to guess if a school is already over the cap. Nothing in the app has ever
-- created a school principle (`savePrinciple` hardcodes 'municipal'), so any row here was
-- seeded or written by hand. Trimming one to fit the new rule would destroy that school's
-- assessments; failing puts the decision on a human. Runs before the renumber so the log
-- shows the cause rather than a CHECK violation on a value this migration itself wrote.
do $$
declare over int;
begin
  select count(*) into over from (
    select school_id from public.principles
    where scope = 'school'
    group by school_id
    having count(*) > 2
  ) x;

  if over > 0 then
    raise exception
      'school principle cap: % school(s) already hold more than 2 principles - resolve by hand before applying',
      over;
  end if;
end $$;

-- Compact each school onto the low slots, preserving the existing relative order.
with slotted as (
  select id,
         999 + row_number() over (partition by school_id order by order_index, created_at, id) as slot
  from public.principles
  where scope = 'school'
)
update public.principles p
set order_index = s.slot
from slotted s
where p.id = s.id
  and p.order_index <> s.slot;

-- The two slots.
alter table public.principles drop constraint principles_order_scope_ck;

alter table public.principles
  add constraint principles_order_scope_ck check (
    (scope = 'municipal' and order_index between 1 and 999) or
    (scope = 'school'     and order_index between 1000 and 1001)
  );

comment on constraint principles_order_scope_ck on public.principles is
  'order_index is projected to the app''s numeric principle id, and municipal + school '
  'principles share that map. 1..999 is the municipal band (active 1..N, retired 90+); '
  '1000..1001 are the two slots a school may own. Widening the per-school cap means '
  'widening this upper bound - it is the single place the number 2 lives.';

-- One principle per slot. Partial: municipal rows carry a null school_id and must not be
-- pulled in. This index, not the CHECK, is what makes the cap survive concurrent writers.
create unique index principles_school_slot_uq
  on public.principles (school_id, order_index)
  where scope = 'school';
