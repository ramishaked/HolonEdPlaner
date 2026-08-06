-- 17 · Activity-bank hygiene: a stable slug per item and a normalised per-principle
--      position. No column is added or dropped — src/database.types.ts is unaffected.
--
--   Why a slug: re-importing the municipality's spreadsheet used to duplicate every
--   row, because the importer had no key to match on. The slug is opaque and derived
--   from the row id, never from content, so correcting a title in the sheet still
--   updates the same row — the same discipline audiencesAdmin.slugForLabel documents.
--
--   Why renumber: the seed numbered each principle block 1..N, but every row created
--   in the wizard since then landed on the hardcoded 999, so "position" stopped
--   meaning anything for new items. From here the admin orders the bank by hand.

-- ── 1 · backfill the empty slugs ─────────────────────────────────────────────
-- Seeded rows already carry real slugs (p3-01 …); only wizard/imported rows are ''.
update public.activity_bank_items
set slug = 'act_' || left(replace(id::text, '-', ''), 12)
where slug = '';

-- ── 2 · normalise position to a per-principle rank ───────────────────────────
-- The curated sheet order survives; the 999s are appended after it. An item linked to
-- several principles is numbered by its lowest-order principle — position is one int
-- on the item, and the planning zone renders it inside one principle tab at a time.
with ranked as (
  select l.item_id, l.principle_id,
         row_number() over (
           partition by l.principle_id
           order by (a.position = 999), a.position, a.created_at, a.title
         ) as rn
  from public.activity_bank_item_principles l
  join public.activity_bank_items a on a.id = l.item_id
  where a.scope = 'municipal'
),
primary_group as (
  select distinct on (r.item_id) r.item_id, r.rn
  from ranked r
  join public.principles p on p.id = r.principle_id
  order by r.item_id, p.order_index
)
update public.activity_bank_items a
set position = g.rn
from primary_group g
where a.id = g.item_id;

-- ── 3 · the upsert key ───────────────────────────────────────────────────────
-- Partial: school-owned rows are not part of the municipal round-trip, and a row that
-- somehow still holds an empty slug must not block the index.
create unique index if not exists activity_bank_items_municipal_slug_uq
  on public.activity_bank_items (municipality_id, slug)
  where scope = 'municipal' and slug <> '';

-- ── 4 · fail loudly rather than leave a half-normalised bank ─────────────────
do $$
begin
  if exists (select 1 from public.activity_bank_items
             where scope = 'municipal' and (slug = '' or position = 999)) then
    raise exception 'activity bank hygiene: rows left un-slugged or un-numbered';
  end if;
end $$;
