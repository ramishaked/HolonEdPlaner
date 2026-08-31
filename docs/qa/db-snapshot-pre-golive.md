# צילום מצב DB לפני בדיקות ה-Go-Live

נלקח ב-30.8.2026, פרויקט Supabase `raifodlpxmseretxbqpn` (הפרויקט המשותף לפרוד ולפיתוח).
משמש כבסיס השוואה לשלב הניקוי: אחרי סיום הבדיקות מריצים את אותה שאילתה ומשווים.

## ספירות טבלאות

| טבלה | שורות |
|---|---|
| schools | 44 (כולם פעילים) |
| profiles | 45 (44 בתי ספר + city_admin) |
| principles | 8 (5 עירוניים פעילים, 2 מוסתרים, 1 בית-ספרי) |
| principle_rubric_levels | 32 |
| principle_sources | 19 |
| activity_bank_items | 93 (92 פעילים) |
| activity_bank_item_principles | 109 |
| audiences | 5 |
| plans | 4 |
| plan_assessments | 6 |
| plan_focus | 3 |
| plan_principle_plans | 4 |
| plan_activities | 3 |
| plan_export_configs | 1 |
| plan_ai_reports | 0 |
| school_files | 0 |

## תוכניות קיימות

| בית ספר | plan_id | נוצר | אבחונים | פעילויות | focus | export |
|---|---|---|---|---|---|---|
| Hogwarts | 0ee72496-0b94-419d-9def-3acf20fd1fd6 | 5.8.2026 | 6 | 3 | 3 | 1 |
| אילון | 0bebc695-72a0-4734-a384-c8570108a701 | 7.8.2026 | 0 | 0 | 0 | 0 |
| אמירים | 9bbbc7ac-18e5-496b-bb10-df249dca0b22 | 7.8.2026 | 0 | 0 | 0 | 0 |
| אשכול | cb1aae73-f457-47da-8ad8-7d6bad0c8b62 | 7.8.2026 | 0 | 0 | 0 | 0 |

שלוש התוכניות הריקות נוצרו בניסויים פנימיים ב-7.8.2026 ואינן מכילות תוכן.

## עקרונות

| order_index | scope | פעיל | שם |
|---|---|---|---|
| 1 | municipal | כן | המיומנויות בליבת העשייה |
| 2 | municipal | כן | תפקיד המורה כמוביל למידה אנושית |
| 3 | municipal | כן | הטמעת AI כתשתית |
| 4 | municipal | כן | חינוך טכנולוגי הוליסטי וספירלי |
| 5 | municipal | כן | גיוון במרחבי ובסביבות הלמידה |
| 90 | municipal | לא | הטמעת מודל BYOD |
| 91 | municipal | לא | תרבות מייקרינג |
| 1000 | school (Hogwarts) | כן | אקלים חינוכי בית ספרי |

## שאילתת ההשוואה

```sql
select 'schools' t, count(*) n from public.schools
union all select 'profiles', count(*) from public.profiles
union all select 'principles_all', count(*) from public.principles
union all select 'activity_bank_items', count(*) from public.activity_bank_items
union all select 'audiences', count(*) from public.audiences
union all select 'plans', count(*) from public.plans
union all select 'plan_assessments', count(*) from public.plan_assessments
union all select 'plan_focus', count(*) from public.plan_focus
union all select 'plan_principle_plans', count(*) from public.plan_principle_plans
union all select 'plan_activities', count(*) from public.plan_activities
union all select 'plan_export_configs', count(*) from public.plan_export_configs
union all select 'school_files', count(*) from public.school_files
order by 1;
```
