-- 13 · An activity can serve several principles.
--   Replaces activity_bank_items.principle_id (single FK) with a join table, so the
--   admin wizard can link one activity to many principles instead of duplicating it.
--   The same item then appears under every principle's tab in the planning zone.

create table public.activity_bank_item_principles (
  item_id      uuid not null references public.activity_bank_items(id) on delete cascade,
  principle_id uuid not null references public.principles(id) on delete cascade,
  primary key (item_id, principle_id)
);
create index abip_principle_id_idx on public.activity_bank_item_principles (principle_id);

-- carry the existing single link over
insert into public.activity_bank_item_principles (item_id, principle_id)
select id, principle_id from public.activity_bank_items where principle_id is not null;

do $$
begin
  if (select count(*) from public.activity_bank_item_principles)
     <> (select count(*) from public.activity_bank_items where principle_id is not null) then
    raise exception 'principle link backfill lost rows';
  end if;
end $$;

alter table public.activity_bank_items drop column principle_id;

-- RLS: the link resolves its scope through the parent activity, like principle_sources.
alter table public.activity_bank_item_principles enable row level security;

create policy abip_select on public.activity_bank_item_principles for select
  using (exists (select 1 from public.activity_bank_items a
                 where a.id = item_id
                   and app.can_read_scoped(a.scope, a.municipality_id, a.school_id)));
create policy abip_write on public.activity_bank_item_principles for all
  using (exists (select 1 from public.activity_bank_items a
                 where a.id = item_id
                   and app.can_write_scoped(a.scope, a.municipality_id, a.school_id)))
  with check (exists (select 1 from public.activity_bank_items a
                 where a.id = item_id
                   and app.can_write_scoped(a.scope, a.municipality_id, a.school_id)));
