# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## מה זה
כלי למנהלי בתי ספר בחולון: אבחון בשלות מוסדית סביב 5 עקרונות ניהול חינוכי
(רובריקה, מפת עכביש, קנבס תוכנית פעולה, הפקת מסמך תוכנית עבודה). ממשק עברית, RTL מלא.
מותג: **הפלנר (Holon School Educational Planner)**.

## Stack
- **Framework:** React 19 + TypeScript (entry `src/main.tsx` → `src/App.tsx`), Vite 6 כ-bundler, Tailwind CSS v4 (פלאגין `@tailwindcss/vite`).
- **AI:** Google Gemini (`@google/genai`, model `gemini-2.5-flash`), **צד שרת בלבד** — `GEMINI_API_KEY` נקרא מ-env, לעולם לא נחשף ללקוח. **כרגע אין קורא בצד הלקוח**: פאנל יועץ ה-AI הוסר ב-2026-08-06 (הוא היה מגודר בתנאי שלא התקיים, ולכן לא הגיע למסך מעולם). נקודות הקצה `api/ai/*` נשארו; לפני שמחזירים אותן לשימוש יש לתקן את `PRINCIPLES_DICT` ב-`api/_lib/ai.ts`, שעדיין מכיל 7 עקרונות בשמות הישנים.
- **Package manager:** npm (`package-lock.json`). Node 24 בסביבה הנוכחית.
- **State:** Supabase (Postgres + Auth + Storage) הוא מקור האמת היחיד לכל מידע דינמי. ב-localStorage נשארו רק העדפות UI פר-מכשיר (`school_principle_menu_collapsed_v1`).
- **UI libs:** lucide-react, react-markdown, motion; פונטים ו-FontAwesome מ-CDN ב-`index.html`.
- **Source:** נזרע מהדמו של Google AI Studio (`EduPlaner-demo files`).

## Commands
- `npm install`
- `npm run dev` → http://localhost:3000 (`tsx server.ts`, Vite middleware mode).
- `npm run lint` — **זו כל בדיקת ה-CI שיש**: `tsc --noEmit`. אין test runner; הרצת בדיקה בודדת לא רלוונטית. תמיד להריץ lint לפני commit.
- `npm run build` — Vite build + esbuild bundle של השרת ל-`dist/server.cjs`.
- `npm start` — מריץ את ה-build בפרוד (`node dist/server.cjs`).
- מפתח AI: `GEMINI_API_KEY` ב-`.env.local` (ראה `.env.example`). האפליקציה עולה גם בלי המפתח — רק פיצ'רי ה-AI יחזירו 500 מנוסחת.

## Architecture (התמונה הגדולה)

### מסע המשתמש (zones) — `src/App.tsx`
`App.tsx` הוא ה-orchestrator: מחזיק את כל ה-state ברמת-העל ומנתב בין שלבי המסע (`Step`):
`onboarding → orient → assess → plan → export`, עם מסך **הגדרות** מחוץ למסע (נפתח מגלגל השיניים).
- `JourneyRail` — סרגל ההתקדמות/ניווט העליון.
- כל zone הוא קומפוננטה ב-`src/components/`: `Onboarding` (כניסה), `OrientView` (היכרות + `PrincipleDetailView`), `DiagnosticView` (אבחון בלבד), `PlanView` (קנבס פעילויות לפי עקרון), `ExportView` (בונה מסמך תוכנית עבודה + ייצוא PDF/Word + **בחירת עוגן העוצמה ויעדי פריצת הדרך**), `SettingsView` (כרטיס ביקור בית-ספרי + ניהול).

### נתוני הליבה
- **כל מידע דינמי מגיע מה-DB בלבד. אין עותק סטטי בקוד — לא כ-fallback ולא כ-mock.** עותק שני תמיד נסחף, ובינתיים מרנדר תוכן שגוי.
  - עקרונות: `principles` + `principle_sources` + `principle_rubric_levels` → `src/lib/principles.ts` → `usePrinciples()`. `src/data.ts` **נמחק** (2026-08-05).
  - בנק הפעילויות: `activity_bank_items` → `src/lib/activityBank.ts` (`useActivityBank()`). `ACTIVITY_BANK_BY_PRINCIPLE` **נמחק**.
  - `App.tsx` חוסם את המסע עד שהעקרונות נטענו (ספינר), ומציג מסך שגיאה עם "נסו שוב" אם הטעינה נכשלה.
- 5 עקרונות, **לפי הסדר הקנוני id1..id5**. ב-2026-08-05 מוזגו "הטמעת מודל BYOD" ו"תרבות מייקרינג" לתוך "חינוך טכנולוגי הוליסטי וספירלי" (מיגרציה `20260805090000_merge_principles_to_five.sql`); השניים לא נמחקו אלא `is_active=false` (מחיקה עושה cascade לכל טבלאות `plan_*`). הרובריקה של עיקרון היעד **לא** שונתה במיזוג — כלומר האבחון מודד רק את ציר הרצף הספירלי.
- `src/components/PrincipleMenu.tsx` — תפריט העקרונות **האחיד** לכל המסכים (אל תבנו תפריט פר-מסך). `PRINCIPLE_SHORT_TITLES` **נגזר** מהעקרונות שנטענו → מקור אמת יחיד לשמות. לשינוי שם עיקרון: מיגרציה על `principles.title`. חריג: `RadarChart.tsx` מחזיק `shortLabels` קצרים כ-fallback ל-`short_label` שמגיע מה-DB.
- `src/planBank.ts` — **רק תצוגה**: `SOURCE_META`/`sourceMeta` (צבע תגית לפי מקור) + `METRICS_MOCK` (הצעות מדדים מוקאפיות). הפריטים עצמם ב-DB.

### חישוב ציון בשלות — `src/lib/scoring.ts` בלבד
לכל עיקרון: `(selectedMaturityLevel * 0.7) + (avg(why,how,what) * 0.3)`. `scoresFor` נותן 1.0 לעיקרון שלא מופה — **נוחות תצוגה לרדאר בלבד**; לאגרגציה בין בתי ספר יש `mappedScores`. `recommendedFocus` גוזר את ההמלצה (החזק ביותר → עוגן עוצמה, שני החלשים → יעדי פריצה); `App` מאתחל ממנה **רק שדות ריקים**, וב-`ExportView` המנהלת יכולה לשנות ולחזור להמלצה.

### שכבת הנתונים (Supabase)
`src/lib/supabase.ts` (client), `src/lib/planData.ts` (כל ה-CRUD של תוכנית בית ספר), `src/lib/principles.ts` + `PrinciplesContext.tsx` (עקרונות), `src/lib/activityBank.ts` (בנק הפעילויות). כל נתוני בית הספר תלויים ב-`plans` row = גרסת תכנון: `plan_assessments`, `plan_focus`, `plan_principle_plans`, `plan_activities`, `plan_export_configs`, `plan_ai_reports`; כרטיס הביקור על `schools`; לוגו וקבצים ב-Storage (`school-assets`, bucket פרטי → signed URLs). שמירות **debounced ב-700ms** ומגודרות ב-`dataLoaded` כדי ש-state ריק ראשוני לא ידרוס שורות.

**ב-localStorage מותר לשמור רק העדפות UI פר-מכשיר** (`school_principle_menu_collapsed_v1`). כל השאר — DB.

**RLS לא מספיק:** בהחלפת משתמש חייבים לאפס state ב-React ומטמונים מקומיים, אחרת נתוני בית ספר אחד דולפים לבא אחריו.

### שכבת ה-AI — שני נתיבים, מודול משותף
ההיגיון נמצא ב-`api/_lib/ai.ts` (`initiate`, `generate`). שני wrappers דקים משתמשים בו:
- **dev:** `server.ts` (Express) מייבא ומשרת `/api/ai/*` + `/api/health`.
- **prod (Vercel):** serverless functions ב-`api/ai/initiate.ts`, `api/ai/generate.ts`, `api/health.ts`.
- **ESM gotcha:** `package.json` הוא `"type":"module"` → imports יחסיים ב-`api/`/`server.ts` חייבים סיומת `.js` (למשל `./api/_lib/ai.js`), אחרת Vercel זורק `ERR_MODULE_NOT_FOUND`.

### Deploy (Vercel)
**מודל הענפים (מ-2026-08-06):** `main` הוא ה-Production Branch של Vercel — **מוקפא** על מה שרץ בפרוד (`holon-edplaner.vercel.app`, כרגע `67b2ae3`, מצב שלפני ה-DB). **לא מחייבים ולא דוחפים ל-`main` בשוטף.** כל עבודת Phase 2 חיה על ענף **`phase-2`** (נדחף ל-origin לגיבוי). דחיפה ל-`phase-2` בונה **preview בלבד** (`target: null`, מוגן ב-Vercel SSO, בלי DB) — לעולם לא נוגעת בפרוד.

**איך עושים deploy לפרוד — רק באישור מפורש מהמשתמש:**
1. Vercel → Project → Settings → Environment Variables (Production): להגדיר `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon/publishable בלבד — **לעולם לא** service_role). `GEMINI_API_KEY` כבר מוגדר ב-Production.
2. לוודא שכל המיגרציות תחת `supabase/migrations/` הוחלו על פרויקט ה-Supabase שהפרוד מצביע אליו.
3. `npm run lint` (tsc --noEmit) + `npm run build` נקיים; לעדכן `CHANGELOG.md`.
4. למזג `phase-2 → main` ולדחוף → Vercel עושה auto-deploy אחד לפרוד.
5. לאמת את הפרוד החי (טעינה, לוגין, טעינת עקרונות מה-DB).

`vercel.json`: framework vite, build `vite build`.

## שלבי פיתוח

### Phase 1 — הדמו על Vercel · **הושלם**
localStorage + ללא auth. הפרוד (`holon-edplaner.vercel.app`) עדיין מריץ את הגרסה הזו — ה-DB **לא** מחובר אליו.

### Phase 2 — DB וריבוי בתי ספר · **השלב הנוכחי (dev בלבד)**
- Supabase מחובר בפיתוח: auth פר בית-ספר (דרופדאון + סיסמה, מאחורי הקלעים session סינתטי) + RLS מלא; פונקציות ההרשאה בסכימה פרטית `app`.
- הגמילה מ-localStorage **הושלמה** — כל מידע דינמי ב-DB, כולל העקרונות ובנק הפעילויות.
- **למנהל המערכת יש כניסה משלו.** ב-`Onboarding` יש מצב `admin` (קישור בתחתית) שמתחבר ל-`ADMIN_EMAIL` (`admin@holon.test`, בפיתוח סיסמה `9999`) על **אותו לקוח `supabase`** הראשי. `App` מנתב לפי `profiles.role`: `city_admin`/`super_admin` מקבלים את `AdminArea` **במקום כל המסע**, ו-bootstrap התוכנית מדולג להם (אין להם `school_id`). אין יותר לקוח Supabase שני.
- **`AdminArea`** = שתי לשוניות: `MunicipalDashboard` (ברירת מחדל) וניהול הבנק + סקירת עקרונות/קהלי יעד, שממנו נפתח `ActivityWizard`.
- **`SettingsView` הוא רק של בית הספר** — אין בו שום דלת ניהול.
- **נוסחת הציון ב-`src/lib/scoring.ts` בלבד.** `scoresFor` נותן 1.0 לעיקרון שלא מופה — זו נוחות תצוגה לרדאר ו**אסור** לממצע אותה בין בתי ספר. לאגרגציה יש `mappedScores`, והדשבורד מציג תמיד את מספר בתי הספר שמאחורי כל ממוצע.
- **בית ספר לא כותב לבנק.** הנתיב היחיד שלו הוא "יוזמה ייחודית / אחר" ב-`PlanView`, שמוסיף לתוכנית בית הספר. ה-RLS אוכף את זה — לא רק ה-UI.
- **טרם נבנה:** ניהול עקרונות וסיסמאות פר בית-ספר במסך האדמין, ו-UI לגרסאות תוכנית (`plans` + `schools.current_plan_id` כבר קיימים).

## כללים קשיחים
- **מפתח AI לעולם לא בצד הלקוח.** היועץ רץ רק דרך `api/_lib/ai.ts` עם env var.
- כל טקסט וכל פריסה — **עברית RTL**.
- **מידע דינמי — ב-DB בלבד.** אין עותקים סטטיים בקוד (לא fallback, לא mock, לא seed חי). שינוי תוכן = מיגרציה תחת `supabase/migrations/`.
- מפתח ה-`service_role` של Supabase, כמו `GEMINI_API_KEY`, לעולם לא בצד הלקוח.
- **לא לעשות deploy לפרוד בלי אישור מפורש מהמשתמש.**
- כותרת ראשית קבועה בכל המסכים: "הפלנר (Holon School Educational Planner)".

## הסכמות עבודה
- commits קטנים וברורים. **בזמן Phase 2 הפרוד מוקפא:** העבודה נצברת על ענף `phase-2` (דוחפים חופשי לגיבוי) ומתמזגת ל-`main` רק בריליז מכוון ומאושר — ראה "Deploy (Vercel)". אין deploy אוטומטי מ-`main` בשוטף.
- לדווח לפני שינויים לא-טריוויאליים.
- בעת עדכון מסך שמציג את העקרונות — להשתמש מחדש ב-`PrincipleMenu` ובסדר הקנוני מ-`usePrinciples()`, לא להמציא חדש. אין לקבע את **מספר** העקרונות בטקסט או בקוד: הוא דינמי (לבית ספר עם עיקרון ייחודי יש יותר).

### מתי שינוי גמור (Definition of Done)
שינוי **פונקציונלי** — פיצ'ר חדש **וגם תיקון באג שמשנה התנהגות** — אינו גמור עד שכל הרלוונטי מבין אלה נעשה, באותו קומיט:
1. **קוד עובר lint** — `npm run lint`.
2. **`docs/functional-spec.html`** — מסמך האפיון הפונקציונלי **החי** (עמוד HTML עצמאי, RTL — הוא-הוא מקור ה-Artifact; אין גרסת markdown נפרדת) מעודכן במתחם/סעיף הרלוונטי. זה מסמך בשפת מנהל מוצר ("מה המערכת עושה"), לא ארכיטקטורה. **גם תיקון באג שמשנה התנהגות שנראית למשתמש מחייב עדכון כאן — לא רק פיצ'רים.** אם השינוי מוסיף/מסיר יכולת, מזיז אותה בין מתחמים, משנה כלל שכתוב במסמך, או מקדם פריט מ"הדגמה" ל"פעיל" — לעדכן (כולל טבלת "מה עדיין הדגמה / טרם נבנה"). refactor/ביצועים שלא נראים למשתמש — לא.
3. **`CHANGELOG.md`** — שורה חדשה (ראו `changelog-discipline`).
4. **`CLAUDE.md`** — אם השינוי סותר תיאור ארכיטקטורה/כלל שכתוב בו.
5. **תוכן/סכימה** — מיגרציה תחת `supabase/migrations/`.

מסמך האפיון מתפרסם כ-Artifact לקריאה עבור הלקוח (מנהל מוצר), URL קבוע: `https://claude.ai/code/artifact/4f670b38-621b-41ed-820c-afc18dd67032`. אחרי עדכון הקובץ — לפרסם מחדש את **אותו path** (Artifact, עם `url` של הארטיפקט הקיים) כדי לשמור על אותו URL.
