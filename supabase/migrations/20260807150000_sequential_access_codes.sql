-- 19 · Each school gets its own sequential access code.
--
--   The previous migration normalised every school to the same `0000`. The intent was
--   one code per school — 0000, 0001, 0002 … — so a principal can be told a code that
--   is theirs alone, and so the admin list is useful at a glance.
--
--   Assignment is `order by name`, which is the order the admin console lists them in,
--   so the printed list and the screen agree. `Hogwarts` (the QA school) is pinned to
--   9999 and excluded from the sequence.
--
--   Deterministic on purpose: re-running this reproduces exactly the same codes, so it
--   is safe against a database where it has already been applied by hand.

with numbered as (
  select id,
         to_char(row_number() over (order by name) - 1, 'FM0000') as code
  from public.schools
  where name <> 'Hogwarts'
)
update public.schools s
set access_code = n.code
from numbered n
where s.id = n.id;

update public.schools set access_code = '9999' where name = 'Hogwarts';

-- Keep the real credential in step with the visible copy. Doing this here rather than
-- through admin_set_school_password() because that function takes one school at a time;
-- the invariant it protects — hash and plain copy always written together — holds.
update auth.users u
set encrypted_password = extensions.crypt(s.access_code, extensions.gen_salt('bf')),
    updated_at = now()
from public.profiles p
join public.schools s on s.id = p.school_id
where u.id = p.id and p.role = 'school';

do $$
begin
  if exists (select 1 from public.schools where access_code = '') then
    raise exception 'sequential access codes: % schools left without a code',
      (select count(*) from public.schools where access_code = '');
  end if;
  if (select count(distinct access_code) from public.schools) <> (select count(*) from public.schools) then
    raise exception 'sequential access codes: codes are not unique';
  end if;
end $$;
