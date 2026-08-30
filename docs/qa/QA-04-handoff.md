# QA-04 · תיקון יצירת בית ספר חדש · מסמך העברה

מסמך עצמאי להמשך עבודה בסשן חדש. מכיל את התסמין, שורש הבעיה, ההוכחה, התיקון המוצע
והאימות. נכתב 30.8.2026 על ענף `claude/system-testing-pre-launch-0p191t`.

---

## התסמין

מנהל עירוני מוסיף בית ספר בלשונית **בתי ספר** (שם + סיסמה בת 4 תווים ומעלה).
השרת מחזיר 207 עם ההודעה "בית הספר נוצר, אך קביעת הסיסמה נכשלה. אפסו אותה מהרשימה."

מה שנשאר ב-DB אחרי הכישלון:

- שורה ב-`public.schools`, פעילה, שמופיעה בדרופדאון הכניסה של כולם.
- שורה ב-`auth.users` עם המייל הסינתטי.
- **אין שורה ב-`public.profiles`.**

בית הספר דוחה כל סיסמה. "איפוס סיסמה" מהרשימה נכשל גם הוא, מאותה סיבה בדיוק.

44 בתי הספר הקיימים תקינים ולא נפגעו.

---

## שורש הבעיה

הטריגר ב-`supabase/migrations/20260807140000_harden_signup_role.sql`:

```sql
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();
```

והפונקציה יוצרת פרופיל רק בתנאי:

```sql
if (new.raw_app_meta_data ? 'role') then
```

התנאי נכון ומאובטח (זו בדיוק ההקשחה של מיגרציה 20: לקרוא את התפקיד מ-`app_metadata`
שרק ה-service_role יכול לכתוב, ולא מ-`user_metadata` שהלקוח שולט בו). הבעיה היא **מתי**
הוא נבדק.

`auth.admin.createUser({ app_metadata })` של GoTrue אינו כותב את ה-`app_metadata`
המותאם ב-INSERT עצמו. הוא מכניס את שורת המשתמש עם `{"provider":"email","providers":["email"]}`
בלבד, ורק אחר כך מעדכן אליה את השדות המותאמים. לכן ברגע שהטריגר `AFTER INSERT` רץ,
`raw_app_meta_data ? 'role'` הוא **false**, הבלוק מדולג, ופרופיל לא נוצר.

בלי פרופיל, `public.admin_set_school_password()` לא מוצאת משתמש:

```sql
select p.id into v_user_id
from public.profiles p
where p.school_id = p_school_id and p.role = 'school'
limit 1;

if v_user_id is null then
  return false;
end if;
```

היא מחזירה `false`, ו-`api/_lib/admin.ts` מתרגם את זה ל-207 עם אזהרת הסיסמה.
**הודעת השגיאה מטעה: הסיסמה מעולם לא הייתה הבעיה.**

### ההוכחה

על בית הספר "פרטי" שנוצר ב-30.8.2026 בשעה 10:32:

| עובדה | ערך |
|---|---|
| `auth.users.created_at` | 10:32:12.352 |
| `auth.users.updated_at` | 10:32:12.379 (מאוחר ב-27ms) |
| `raw_app_meta_data` הסופי | `{"role":"school","school_id":"a39a2548-…","provider":"email","providers":["email"]}` |
| שורת `profiles` | לא קיימת |

ה-27 מילישניות בין ה-INSERT לעדכון הן בדיוק העדכון שמוסיף את ה-`app_metadata`.

ההיסק חד-משמעי: אילו `role` היה בשורה ברגע ה-INSERT, ה-INSERT ל-`profiles` היה מתבצע,
או שהיה נכשל ומפיל את יצירת המשתמש כולה (חריגה בטריגר `AFTER INSERT` מבטלת את הטרנזקציה).
המשתמש קיים והפרופיל לא, כלומר התנאי היה false.

למה 44 בתי הספר הקיימים תקינים: הם נוצרו ב-4.8.2026 בהזרקה אחת שכתבה את ה-metadata
כבר בשורת ה-INSERT, ולכן הטריגר פעל כמצופה. הבאג נוגע רק לבתי ספר שנוצרים דרך
`auth.admin.createUser`, כלומר כל בית ספר חדש מהיום.

---

## התיקון המוצע

שתי שכבות. הראשונה מתקנת, השנייה מונעת כישלון שקט בעתיד.

### שכבה 1 · מיגרציה: שהטריגר יתפוס גם את העדכון

קובץ חדש תחת `supabase/migrations/`, למשל `20260830100000_profile_on_meta_update.sql`.

```sql
-- 21 · יצירת בית ספר חדש נכשלה: הפרופיל לא נוצר.
--
-- התסמין
-- הוספת בית ספר מלשונית "בתי ספר" החזירה "קביעת הסיסמה נכשלה" והשאירה בית ספר
-- שמופיע בדרופדאון ודוחה כל סיסמה.
--
-- הסיבה
-- `auth.admin.createUser({ app_metadata })` לא כותב את ה-app_metadata המותאם
-- ב-INSERT עצמו: הוא מכניס את השורה ומיד אחריה מעדכן אליה את השדות. הטריגר
-- on_auth_user_created היה AFTER INSERT בלבד, ולכן ראה שורה בלי `role`,
-- דילג על יצירת הפרופיל, ו-admin_set_school_password לא מצאה משתמש.
--
-- התיקון
-- טריגר נוסף על עדכון של raw_app_meta_data. הוא לא מרחיב את מודל האמון של
-- מיגרציה 20: raw_app_meta_data עדיין ניתן לכתיבה רק דרך ה-admin API עם
-- service_role, כך שהמקור נשאר "השרת ערב לתפקיד הזה".
--
-- ה-insert הופך לאידמפוטנטי (on conflict do nothing) כי שני הטריגרים עלולים
-- לרוץ על אותו משתמש. במכוון אין `do update`: שינוי תפקיד של משתמש קיים אינו
-- זרימה נתמכת, ולתת לעדכון metadata לשנות תפקיד היה פותח דלת חדשה.

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- raw_app_meta_data, NOT raw_user_meta_data: the latter is client-supplied.
  if (new.raw_app_meta_data ? 'role') then
    insert into public.profiles (id, role, school_id, municipality_id, display_name)
    values (
      new.id,
      (new.raw_app_meta_data ->> 'role')::public.user_role,
      nullif(new.raw_app_meta_data ->> 'school_id', '')::uuid,
      nullif(new.raw_app_meta_data ->> 'municipality_id', '')::uuid,
      coalesce(new.raw_user_meta_data ->> 'display_name', '')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- `update of raw_app_meta_data` מצמצם את ההפעלה למשפטים שנוגעים בעמודה הזו,
-- וה-when מוודא שהתפקיד אכן נוסף. התחברות רגילה מעדכנת last_sign_in_at בלבד
-- ולכן לא מפעילה את הטריגר.
drop trigger if exists on_auth_user_meta_role on auth.users;
create trigger on_auth_user_meta_role
after update of raw_app_meta_data on auth.users
for each row
when (
  new.raw_app_meta_data ? 'role'
  and old.raw_app_meta_data is distinct from new.raw_app_meta_data
)
execute function app.handle_new_user();

-- Backfill: כל משתמש שנוצר בנתיב השבור ונשאר בלי פרופיל.
insert into public.profiles (id, role, school_id, municipality_id, display_name)
select u.id,
       (u.raw_app_meta_data ->> 'role')::public.user_role,
       nullif(u.raw_app_meta_data ->> 'school_id', '')::uuid,
       nullif(u.raw_app_meta_data ->> 'municipality_id', '')::uuid,
       coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
where u.raw_app_meta_data ? 'role'
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
```

`on conflict (id)` תקין: אומת ב-30.8.2026 שקיים `profiles_pkey PRIMARY KEY (id)`.

### שכבה 2 · שהשרת לא ידווח הצלחה חלקית על מצב שבור

ב-`api/_lib/admin.ts`, בפונקציית היצירה (סביב שורות 197-225): אחרי `createUser`
ולפני `admin_set_school_password`, לוודא שהפרופיל קיים; אם לא, ליצור אותו,
ואם גם זה נכשל, למחוק את בית הספר ואת משתמש ה-auth ולהחזיר שגיאה אמיתית במקום 207.

הנימוק: כרגע כישלון של קביעת הסיסמה מותיר בית ספר שבור ומדווח עליו כאזהרה קלה.
עדיף שהיצירה תיכשל במלואה ותנקה אחריה, כפי שכבר נעשה בענף `authError` הקיים
("Don't leave a school nobody can sign in to").

בנוסף: הודעת ה-207 הנוכחית מטעה. אם משאירים אותה, שתאמר מה באמת קרה.

---

## איך לאמת שהתיקון עובד

1. להחיל את המיגרציה על פרויקט ה-Supabase.
2. ליצור בית ספר חדש מלשונית **בתי ספר** עם סיסמה בת 4 תווים.
3. לוודא שהתגובה 200 ולא 207, ושהכניסה עם הסיסמה עובדת מיד.
4. שאילתת בדיקה, אמורה להחזיר אפס שורות:

```sql
select u.id, u.email, u.created_at
from auth.users u
where u.raw_app_meta_data ? 'role'
  and not exists (select 1 from public.profiles p where p.id = u.id);
```

5. לוודא שהתחברות רגילה לא מפעילה את הטריגר החדש (עדכון `last_sign_in_at` בלבד
   אינו נוגע ב-`raw_app_meta_data`).
6. לוודא שההקשחה של מיגרציה 20 עדיין מחזיקה: הרשמה עצמית עם `role` ב-`user_metadata`
   עדיין לא יוצרת פרופיל.

---

## מצב נוכחי ב-DB

בית הספר **"פרטי"** (`a39a2548-5ddf-4761-a8b1-fa7bc02237cb`, משתמש
`9a967c32-7f89-490b-8448-6baaf5bcc0ac`) נוצר בנתיב השבור ותוקן ידנית:
נוצרה שורת `profiles`, ונקבעה סיסמה `9999` דרך `admin_set_school_password`.
הוא עובד ומשמש כבית הספר הפיקטיבי השני לבדיקות, לצד **Hogwarts** (סיסמה `9999`).

**ה-backfill במיגרציה לא ישנה אותו** כי כבר יש לו פרופיל, וזה תקין.

---

## Definition of Done

לפי `CLAUDE.md`, תיקון באג שמשנה התנהגות שנראית למשתמש מחייב באותו קומיט:

1. `npm run lint` נקי.
2. עדכון `docs/functional-spec.html` — היכולת "הוספת בית ספר" עוברת משבורה לעובדת.
3. שורה ב-`CHANGELOG.md`.
4. העלאת `version` ב-`package.json`, זהה לגרסה העליונה ב-CHANGELOG ולתג ב-functional-spec.
5. המיגרציה תחת `supabase/migrations/`.

**אין לעשות deploy לפרוד בלי אישור מפורש.** שים לב שפרוד ופיתוח חולקים את אותו
פרויקט Supabase, ולכן החלת המיגרציה נוגעת בנתונים החיים.

---

## הקשר להמשך הבדיקות

הבאג הזה אותר במהלך סבב בדיקות טרום שחרור. שאר הממצאים ב-`docs/qa/findings.md`
(QA-01 עד QA-03), וצילום מצב ה-DB ב-`docs/qa/db-snapshot-pre-golive.md`.
תוכנית הבדיקות המלאה: https://claude.ai/code/artifact/8fc668d0-4230-4841-a4e2-e1f69f2e751d

**חסם סביבתי לידיעת הסשן הבא:** בסביבה המרוחקת שבה נכתב המסמך, מדיניות הרשת חוסמת
CONNECT ל-`raifodlpxmseretxbqpn.supabase.co` (403), ולכן האפליקציה עולה אך לא מצליחה
לטעון נתונים, ובדיקות UI מקצה לקצה אינן אפשריות שם. גישת SQL דרך כלי ה-MCP של Supabase
כן עובדת. כדי להריץ בדיקות UI צריך לפתוח את הדומיין במדיניות הרשת של הסביבה,
או להריץ אותן מקומית.
