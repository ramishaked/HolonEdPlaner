-- 11 · Audiences become dynamic DB data.
--   Until now the bank carried free-text "קהל יעד" (30 distinct phrasings from the
--   source sheet) while the plan offered a 3-value hardcoded enum — so the card and
--   the dropdown never agreed, and every added activity defaulted to 'all'.
--
--   Now: one `audiences` lookup table (municipality-scoped, editable by a city admin)
--   and a multi-select on both the bank item and the planned activity, plus a free-text
--   note for "אחר" and for details the 5 canonical values can't carry ("שכבת ח'").

create table public.audiences (
  id              uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  slug            text not null,
  label           text not null,
  position        int  not null default 0,
  -- marks the catch-all option; the UI reveals the free-text field when it is picked.
  is_other        boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (municipality_id, slug)
);
create index audiences_municipality_id_idx on public.audiences (municipality_id);

create trigger trg_audiences_updated before update on public.audiences
  for each row execute function public.set_updated_at();

alter table public.audiences enable row level security;

-- Readable by anyone in the municipality (it is a picklist); only a city admin edits it.
create policy audiences_select on public.audiences for select
  using (app.is_super_admin() or municipality_id = app.auth_municipality_id());
create policy audiences_write on public.audiences for all
  using (app.is_super_admin()
         or (app.auth_role() = 'city_admin' and municipality_id = app.auth_municipality_id()))
  with check (app.is_super_admin()
         or (app.auth_role() = 'city_admin' and municipality_id = app.auth_municipality_id()));

insert into public.audiences (municipality_id, slug, label, position, is_other)
select (select id from public.municipalities where slug = 'holon'), x.slug, x.label, x.position, x.is_other
from (values
  ('principal', 'מנהלת', 'principal', 1, false),
  ('educational_staff', 'צוות חינוכי', 'educational_staff', 2, false),
  ('grade_students', 'תלמידי השכבה', 'grade_students', 3, false),
  ('all_students', 'כלל התלמידים', 'all_students', 4, false),
  ('other', 'אחר', 'other', 5, true)
) as x(slug, label, ignored, position, is_other);

-- ── bank items: free text → canonical slugs + note ───────────────────────────
alter table public.activity_bank_items add column if not exists audiences     text[] not null default '{}';
alter table public.activity_bank_items add column if not exists audience_note text   not null default '';

update public.activity_bank_items set
  audiences = case audience
    when 'תלמידים וצוות הוראה' then ARRAY['all_students', 'educational_staff']::text[]
    when 'צוות הוראה' then ARRAY['educational_staff']::text[]
    when 'תלמידים' then ARRAY['all_students']::text[]
    when 'צוות הנהלה' then ARRAY['principal']::text[]
    when 'כלל באי בית הספר' then ARRAY['principal', 'educational_staff', 'all_students']::text[]
    when 'צוות הוראה ותלמידים' then ARRAY['educational_staff', 'all_students']::text[]
    when 'צוות הנהלה והוראה' then ARRAY['principal', 'educational_staff']::text[]
    when 'תלמידים, הורים וצוות' then ARRAY['all_students', 'educational_staff', 'other']::text[]
    when 'הורים' then ARRAY['other']::text[]
    when 'הורים וצוות הוראה' then ARRAY['educational_staff', 'other']::text[]
    when 'כלל צוות ההוראה' then ARRAY['educational_staff']::text[]
    when 'מורי מקצועות הומניים' then ARRAY['educational_staff']::text[]
    when 'מחנכים ותלמידים' then ARRAY['educational_staff', 'all_students']::text[]
    when 'נערות' then ARRAY['other']::text[]
    when 'צוות הוראה והנהלה' then ARRAY['educational_staff', 'principal']::text[]
    when 'צוות היגוי' then ARRAY['other']::text[]
    when 'צוות היגוי והנהלה' then ARRAY['principal', 'other']::text[]
    when 'צוות הנהלה והורים' then ARRAY['principal', 'other']::text[]
    when 'צוות חדשנות' then ARRAY['other']::text[]
    when 'צוות מנהלה ומזכירות' then ARRAY['other']::text[]
    when 'רכזי מקצוע ורכז תקשוב' then ARRAY['educational_staff']::text[]
    when 'תלמידי חטיבת ביניים' then ARRAY['grade_students']::text[]
    when 'תלמידי יסודי (א''-ד'')' then ARRAY['grade_students']::text[]
    when 'תלמידי מגמות טכנולוגיות' then ARRAY['grade_students']::text[]
    when 'תלמידי שכבת הפיילוט' then ARRAY['grade_students']::text[]
    when 'תלמידי שכבת ח''' then ARRAY['grade_students']::text[]
    when 'תלמידים והורים' then ARRAY['all_students', 'other']::text[]
    when 'תלמידים וקהילה' then ARRAY['all_students', 'other']::text[]
    when 'תלמידים חסרי ציוד' then ARRAY['all_students']::text[]
    when 'תלמידים, הורים וקהילה' then ARRAY['all_students', 'other']::text[]
    else ARRAY[]::text[]
  end,
  audience_note = case audience
    when 'תלמידים, הורים וצוות' then 'הורים'
    when 'הורים' then 'הורים'
    when 'הורים וצוות הוראה' then 'הורים'
    when 'מורי מקצועות הומניים' then 'מורי מקצועות הומניים'
    when 'מחנכים ותלמידים' then 'מחנכים'
    when 'נערות' then 'נערות'
    when 'צוות היגוי' then 'צוות היגוי'
    when 'צוות היגוי והנהלה' then 'צוות היגוי'
    when 'צוות הנהלה והורים' then 'הורים'
    when 'צוות חדשנות' then 'צוות חדשנות'
    when 'צוות מנהלה ומזכירות' then 'צוות מנהלה ומזכירות'
    when 'רכזי מקצוע ורכז תקשוב' then 'רכזי מקצוע ורכז תקשוב'
    when 'תלמידי חטיבת ביניים' then 'חטיבת ביניים'
    when 'תלמידי יסודי (א''-ד'')' then 'יסודי (א''-ד'')'
    when 'תלמידי מגמות טכנולוגיות' then 'מגמות טכנולוגיות'
    when 'תלמידי שכבת הפיילוט' then 'שכבת הפיילוט'
    when 'תלמידי שכבת ח''' then 'שכבת ח'''
    when 'תלמידים והורים' then 'הורים'
    when 'תלמידים וקהילה' then 'קהילה'
    when 'תלמידים חסרי ציוד' then 'תלמידים חסרי ציוד קצה'
    when 'תלמידים, הורים וקהילה' then 'הורים וקהילה'
    else ''
  end;

do $$
begin
  if exists (select 1 from public.activity_bank_items where cardinality(audiences) = 0) then
    raise exception 'audience migration: % bank items did not map to any audience',
      (select count(*) from public.activity_bank_items where cardinality(audiences) = 0);
  end if;
end $$;

alter table public.activity_bank_items drop column audience;

-- ── planned activities: the 3-value enum → the same multi-select ─────────────
alter table public.plan_activities add column if not exists audiences     text[] not null default '{}';
alter table public.plan_activities add column if not exists audience_note text   not null default '';

update public.plan_activities set audiences = case target
    when 'all'      then ARRAY['educational_staff', 'all_students']::text[]
    when 'layers'   then ARRAY['grade_students']::text[]
    when 'teachers' then ARRAY['educational_staff']::text[]
    else ARRAY[]::text[]
  end;

alter table public.plan_activities drop column target;
drop type if exists public.activity_target;
