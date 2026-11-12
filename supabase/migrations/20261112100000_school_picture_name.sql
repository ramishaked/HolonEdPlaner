-- 23 · schools.picture_name: the school's name in the tech-matriculation sheet.
--
-- "התמונה החינוכית" (a new journey zone) shows a school its own figures from the
-- city's tech-matriculation sheet. The sheet names schools differently from this app
-- ("קרית שרת" there, "ק"ש" here), covers only the secondary schools, and holds a
-- six-year school as one row where this app has two logins (חט"ב + תיכון). So the
-- link is an explicit column, null for a school that has no rows in the sheet.
--
-- The column decides WHOSE figures a login sees, so it is an identity column: only the
-- admin path may write it. app.lock_school_columns() (migration 22) is extended to
-- force it back for an end-user caller, exactly like `name`.

alter table public.schools add column if not exists picture_name text;

comment on column public.schools.picture_name is
  'שם בית הספר בגיליון מדד הטק (התמונה החינוכית). null = אין לבית הספר נתונים שם.';

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
  new.picture_name    := old.picture_name;

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

-- The link itself, by this app's school name. A six-year school's two logins both
-- point at its single sheet row. Three sheet schools (אורט, יונתן, הראל) have no
-- matching login yet and are left out.
update public.schools s set picture_name = m.sheet
from (values
  ('אילון',            'אילון'),
  ('חט"ב איילון',      'אילון'),
  ('חט״ב אלון',        'אלון'),
  ('חט"ב ארן',         'ארן'),
  ('תיכון הייטק היי',  'הייטק היי'),
  ('חט"ב הייטק היי',   'הייטק היי'),
  ('הרצוג',            'הרצוג'),
  ('יבנה',             'יבנה'),
  ('נבון',             'נבון'),
  ('עתידים',           'עתידים'),
  ('קוגל',             'קוגל'),
  ('חט"ב קוגל',        'קוגל'),
  ('קציר',             'קציר'),
  ('ק"ש',              'קרית שרת')
) as m(app, sheet)
where s.name = m.app and s.picture_name is null;
