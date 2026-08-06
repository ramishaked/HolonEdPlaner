-- 09 · Merge 7 principles → 5.
--   "הטמעת מודל BYOD" + "תרבות מייקרינג" are absorbed into
--   "חינוך טכנולוגי הוליסטי וספירלי" and retired (is_active = false, NOT deleted —
--   the plan_* tables cascade on delete, so a hard delete would destroy any school's
--   work attached to them). Rubric levels of the target are deliberately untouched.
--   Mirrors the same edit in src/data.ts (the client-side fallback).

-- ── guard: the three rows must exist. They are identified by title throughout —
--   titles are never rewritten here, so every statement below resolves the same
--   rows regardless of statement/transaction boundaries.
do $$
begin
  if (select count(*) from public.principles
      where scope = 'municipal'
        and title in ('חינוך טכנולוגי הוליסטי וספירלי', 'הטמעת מודל BYOD', 'תרבות מייקרינג')) <> 3
  then
    raise exception 'merge aborted: expected the 3 principles involved in the merge';
  end if;
end $$;

-- ── 1 · merged content onto the target (rubric levels left as-is) ────────────
update public.principles set
  short_summary           = 'שילוב הטכנולוגיה בכלל מקצועות הדעת ברצף רב-שנתי, לרבות המכשיר האישי (BYOD) ותרבות היצירה והמייקרינג.',
  rationale               = 'אוריינות דיגיטלית וטכנולוגית אינה יכולה להיות מוגבלת לשיעור מחשבים מבודד. החזון מחייב תפיסה הוליסטית שבה הטכנולוגיה שזורה כחוט השני בכל מקצועות הדעת (הומניסטיקה, שפות, מדעים ואמנויות), ותפיסה ספירלית המבטיחה רצף והתפתחות של מיומנויות משכבת גיל אחת לבאה אחריה. שני נדבכים משלימים נכללים בעיקרון זה: המכשיר האישי של הלומד (BYOD) כתשתית פדגוגית המאפשרת למידה בכל מקום ובכל זמן — הפיכתו מגורם מוסחות לכלי עבודה מנוהל ומעצים בשירות הלמידה; ותרבות המייקרינג והיצירה, המוציאה את הלמידה מהתחום התיאורטי אל עולם המעשה המוחשי ומפתחת חשיבה עיצובית, יצירתיות, עמידות בפני כישלונות ותחושת מסוגלות.',
  gaps_solved             = ARRAY['למידה מנותקת: מניעת מצב שבו תלמיד לומד כלים דיגיטליים בשיעור טכנולוגיה, אך חוזר למחברת ולשינון פסיבי בשיעור היסטוריה או ספרות.', 'חוסר רציפות: מניעת כפילויות או פערים ברמת האוריינות של תלמידים במעבר בין שכבות גיל.', 'רלוונטיות ופער דיגיטלי (BYOD): גישור על הפער בין השימוש הדיגיטלי האינטנסיבי של התלמיד מחוץ לבית הספר לבין שיטות הלמידה בתוכו, ופתרון המחסור הכרוני במחשבים זמינים ו''נדודים'' לחדר מחשבים.', 'ניהול מבוסס נתונים (BYOD): מעבר לסביבת ענן מוסדרת מאפשר למורה ולמנהל להוביל למידה וניהול מבוססי נתונים, ולקיים למידה שיתופית, פרויקטלית ודיפרנציאלית.', 'למידה תיאורטית מנותקת מעשייה (מייקרינג): פתרון הנתק בין החומר הנלמד לבין העולם האמיתי והצורך הפיזי ביצירה, וקידום חשיבה יזמית ואוריינות חקר.', 'מגבלת משאבים בית-ספרית (מייקרינג): עקיפת חוסר היכולת של בית ספר בודד להחזיק מעבדות מייקרס מתקדמות (מדפסות תלת-ממד, חותכי לייזר, רובוטיקה), באמצעות שימוש חכם במשאב העירוני המשותף.'],
  added_value             = 'התלמיד מפתח תפיסה של הטכנולוגיה כשפה טבעית וכלי עבודה לפתרון בעיות אמיתיות, ולא כנושא לימוד מופשט ובודד — תוך דיגיטליות אחראית (המכשיר מיועד ליצירה, חקר ושיתופיות ולא לצריכת תוכן פסיבית) ותוך יכולת להוציא רעיון אל תוצר מוחשי ועובד.',
  implementation_strategy = ARRAY['ישיבות עבודה חודשיות קבועות בין רכז התקשוב לבין רכזי המקצועות השונים (רכזי שפה, מתמטיקה, מדעים) לבניית יחידות לימוד משולבות טכנולוגיה.', 'בניית מפת דרכים בית-ספרית המגדירה אילו כלים טכנולוגיים רוכש הלומד בכל שכבת גיל. המיומנות הולכת ונבנית נדבך על גבי נדבך.', 'תכנון הלימודים במקצועות הרוח, החברה והמדעים כולל שימוש קבוע ואינטגרלי בכלים דיגיטליים. שיעור היסטוריה או ספרות עושה שימוש טבעי בפלטפורמות דיגיטליות מתקדמות לצורך חקירה, פיתוח פרויקטים והצגת תוצרים.', 'BYOD — מעבר לסביבת ענן מוסדרת (Google Classroom) שבה מרוכזים כל חומרי ההוראה למורה ולתלמיד, לצד מעבר הדרגתי לספרים ומקורות מידע דיגיטליים.', 'BYOD — הדרכה מובנית של מדריכה עירונית מנוסה לצוות המוביל הבית-ספרי (אופן ההטמעה, מדדי ההצלחה, ביטויים ראשוניים), והמשכה במליאות מורים ובצוותים השכבתיים.', 'מייקרינג — שיבוץ מובנה וקבוע של ''בלוקים'' במערכת השעות (למשל חצי יום שבועי לשכבה), המועתקים פיזית למרכזי החדשנות העירוניים (''אתחלא'' / ''בית רותר'').', 'מייקרינג — למידה מבוססת תוצרים (PBL): פרויקטים שנתיים או סמסטריאליים שבהם התלמידים מתכננים ומייצרים מוצרים אמיתיים המשיבים לאתגרים קהילתיים או מדעיים.'],
  sacrifices_required     = 'הפחתת מספר המבחנים הפרונטליים המסורתיים לטובת משימות הערכה דיגיטליות רב-תחומיות; הפסקת עבודה עם דפי עבודה פיזיים מודפסים והפחתת השימוש בספרים מודפסים; וויתור על שעות פרונטליות בכיתת האם ועל חלוקת הזמן הנוקשה של שיעורים בני 45 דקות, לטובת עבודה מבוססת פרויקטים.',
  ecosystem_partnerships  = 'עבודה מול משרד החינוך (הפיקוח המקצועי) לאישור חלופות בהערכה; שיתוף פלטפורמות ותשתיות עם מחלקת המחשוב העירונית ולמידה מבתי ספר עירוניים ותיקים במהלך ה-BYOD; וסנכרון תפעולי ופדגוגי מול מנהלי מרכזי החדשנות העירוניים (''אתחלא'' / ''בית רותר''), כולל מערך הסעות ושותפויות עם תעשייה ואקדמיה מקומית.',
  kpis                    = ARRAY['קיומה של מפת מיומנויות דיגיטליות בית-ספרית מוגדרת לכל שכבת גיל (ספירלה).', 'מספר הפרויקטים הרב-תחומיים המשולבים טכנולוגיה המבוצעים בכל מחצית.', 'אחוז השיעורים שבהם נעשה שימוש במכשיר הקצה האישי לצורך פדגוגי אקטיבי (חקר, שיתוף, יצירה).', 'תחושת הביטחון של המורים בכלים הטכנולוגיים שנבחרו (יש לבחור מעט כאלה ולהעמיק בהם).', 'מספר התוצרים הפיזיים/דיגיטליים העומדים בקריטריונים של מוצר עובד בסוף תהליך, ואחוז שכבות הגיל המקיימות רצף עבודה קבוע במרחבים העירוניים.'],
  teacher_deliverable     = 'רכזי המקצוע מחזיקים בתוכנית לימודים מעודכנת המשלבת כלי דיגיטלי ייעודי בכל רבעון פדגוגי; המורה מנהל כיתה דיגיטלית בביטחון (פלטפורמות שיתופיות ובדיקת הבנה בזמן אמת) ומיומן בהנחיית למידה מבוססת פרויקטים בשיתוף מנטורים מהמרכזים העירוניים.',
  student_deliverable     = 'תיק עבודות דיגיטלי (E-Portfolio) המלווה את התלמיד ומציג תוצרי למידה מבוססי טכנולוגיה ממגוון מקצועות (פודקאסט בספרות, בלוג בהיסטוריה, מודל במדעים), לצד שליטה אחראית בסביבת הלמידה הדיגיטלית האישית ותוצר פיזי או דיגיטלי עובד המשיב לבעיה מוגדרת.',
  first_step              = 'הצגת ''מפת המיומנויות הדיגיטליות הספירלית'' לצוות בערב פתיחת השנה והגדרת הכלי הטכנולוגי הראשון שבו כל מורי בית הספר ישתמשו עם התלמידים בשבועיים הראשונים; במקביל — פתיחת תהליך מובנה של המדריכה העירונית עם צוות ההובלה, וישיבת הנהלה עם נציגי ''אתחלא'' ו''בית רותר'' לחתימה על גאנט משותף ושיבוץ השכבות במערכת.'
where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי';

-- ── 2 · absorb the retired principles' sources (idempotent on url) ───────────
insert into public.principle_sources (principle_id, title, description, url, keywords, order_index)
select (select id from public.principles
        where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי'),
       x.title, x.description, x.url, x.keywords, x.ord
from (values
    ('אתר משרד החינוך - חוזרי מנכ"ל', 'מסמכי המדיניות הרשמיים בנושא שילוב מכשירי קצה אישיים בבתי הספר, הכוללים הנחיות ארגוניות, פתרונות תקשוב, חוקי מוגנות ושמירה על שוויון הזדמנויות חברתי.', 'https://www.gov.il/he/departments/ministry_of_education', 'שילוב מכשירי קצה אישיים / אמנת BYOD', 2),
    ('איגוד האינטרנט הישראלי', 'ערכות מוכנות לבתי ספר לניסוח אמנות דיגיטליות משותפות (מורים-הורים-תלמידים), ומאמרים על הפיכת הסמארטפון מגורם מוסחות לכלי מחקר אקטיבי.', 'https://www.isoc.org.il', 'מוגנות ברשת -> אזרחות דיגיטלית בבתי ספר', 3),
    ('הקרן לעידוד יוזמות חינוכיות', 'מאגר עצום של יוזמות שטח מבוססות תרבות המייקינג (Making) ולמידה התנסותית, המציג מודלים של עבודה מחוץ לכותלי בית הספר.', 'https://www.yozo.org.il', 'למידת מייקרים / PBL באקו סיסטם', 4),
    ('מכון ברנקו וייס', 'תיאוריות ומדריכים על ''למידה מבוססת מקום'' (Place-Based Education) ופדגוגיה של פרויקטים המשלבת ידיים עובדות וחשיבה עיצובית.', 'https://brancoweiss.org.il', 'משאבים ומאמרים -> למידה מבוססת פרויקטים', 5)
) as x(title, description, url, keywords, ord)
where not exists (
  select 1 from public.principle_sources s
  where s.principle_id = (select id from public.principles
                          where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי')
    and s.url = x.url and s.title = x.title
);

-- ── 3 · move everything that still has meaning under the merged principle ────
-- Activity-bank items and planned activities carry over as-is.
update public.activity_bank_items set principle_id = (select id from public.principles
  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי')
where principle_id in (select id from public.principles
  where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'));

update public.plan_activities set principle_id = (select id from public.principles
  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי')
where principle_id in (select id from public.principles
  where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'));

-- Per-principle plan rows + focus anchors: move, unless the plan already has one
-- for the target (unique (plan_id, principle_id[, role])) — then drop the retired row.
delete from public.plan_principle_plans r
where r.principle_id in (select id from public.principles
    where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'))
  and exists (select 1 from public.plan_principle_plans t
              where t.plan_id = r.plan_id
                and t.principle_id = (select id from public.principles
                  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי'));
update public.plan_principle_plans set principle_id = (select id from public.principles
  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי')
where principle_id in (select id from public.principles
  where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'));

delete from public.plan_focus r
where r.principle_id in (select id from public.principles
    where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'))
  and exists (select 1 from public.plan_focus t
              where t.plan_id = r.plan_id and t.role = r.role
                and t.principle_id = (select id from public.principles
                  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי'));
update public.plan_focus set principle_id = (select id from public.principles
  where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי')
where principle_id in (select id from public.principles
  where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'));

-- Assessments are scores against rubrics that are NOT carried over (the target keeps
-- its own 4 levels), so they cannot be transferred meaningfully — they are dropped.
delete from public.plan_assessments
where principle_id in (select id from public.principles
  where scope = 'municipal' and title in ('הטמעת מודל BYOD', 'תרבות מייקרינג'));

-- ── 4 · retire the two, renumber the rest ────────────────────────────────────
update public.principles set is_active = false, order_index = 90
where scope = 'municipal' and title = 'הטמעת מודל BYOD';
update public.principles set is_active = false, order_index = 91
where scope = 'municipal' and title = 'תרבות מייקרינג';

update public.principles set order_index = 4
where scope = 'municipal' and title = 'חינוך טכנולוגי הוליסטי וספירלי';
update public.principles set order_index = 5
where scope = 'municipal' and title = 'גיוון במרחבי ובסביבות הלמידה';

-- School-owned custom principles follow the municipal five, keeping their relative order.
with ranked as (
  select id, 5 + row_number() over (order by order_index, title) as new_order
  from public.principles
  where scope = 'school' and is_active
)
update public.principles p set order_index = r.new_order
from ranked r where p.id = r.id;
