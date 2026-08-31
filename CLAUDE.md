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
  **שינוי ב-`api/` או ב-`server.ts` מחייב הפעלה מחדש של השרת.** Vite עושה HMR ל-`src/` בלבד; `server.ts` הוא תהליך Node שמייבא את `api/_lib/*` פעם אחת בעלייה. התסמין מבלבל: הלקוח כבר מעודכן ומצפה לשדה חדש, השרת עדיין מחזיר את הישן, והמסך מציג ערך ריק או `—` בלי שום שגיאה. אם שדה שהוספת בשרת "לא מגיע" — זו הסיבה, לפני שמחפשים באג.
- `npm run lint` — **זו כל בדיקת ה-CI שיש**: `tsc --noEmit`. אין test runner; הרצת בדיקה בודדת לא רלוונטית. תמיד להריץ lint לפני commit.
- `npm run build` — Vite build + esbuild bundle של השרת ל-`dist/server.cjs`.
- `npm start` — מריץ את ה-build בפרוד (`node dist/server.cjs`).
- מפתח AI: `GEMINI_API_KEY` ב-`.env.local` (ראה `.env.example`). האפליקציה עולה גם בלי המפתח — רק פיצ'רי ה-AI יחזירו 500 מנוסחת.
- מפתח שרת: `SUPABASE_SERVICE_ROLE_KEY` ב-`.env.local` (**בלי** קידומת `VITE_` — אחרת Vite יארוז אותו ללקוח). בלעדיו כל האפליקציה עובדת חוץ מלשונית **בתי ספר** במסך הניהול, שתציג שגיאה מנוסחת. בפרוד יש להגדיר אותו ב-Vercel כמשתנה סביבה של Production.

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
- `src/components/PrincipleMenu.tsx` — תפריט העקרונות **האחיד** לכל מסכי המסע הבית-ספרי (אל תבנו תפריט פר-מסך). `PRINCIPLE_SHORT_TITLES` **נגזר** מהעקרונות שנטענו → מקור אמת יחיד לשמות. שינוי שם עיקרון נעשה מאזור הניהול (או במיגרציה על `principles.title`).
  **חריג מכוון:** `src/components/admin/PrinciplesTab.tsx` מרנדר רשימת עקרונות משלו. `PrincipleMenu` דורש `scores`/`answers` (מצב אבחון שלמנהל אין), מציג רק עקרונות פעילים, ואין בו מקום לחצי סדר או לתג פעיל/מוסתר. הסדר הקנוני והשמות עדיין מגיעים מה-DB דרך `usePrinciples()`/`useAdminPrinciples()`.
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
- **שתי נקודות הקצה דורשות משתמש מחובר** — `requireUser()` ב-`api/_lib/auth.ts`, שנקרא **בתוך** `initiate`/`generate` ולא ב-wrappers, כדי ש-wrapper שלישי לא יוכל לשכוח. משתמש במפתח ה-anon (לא service_role), ו**נכשל סגור** אם ההגדרה חסרה. `api/health` נשאר פתוח.
- **ESM gotcha:** `package.json` הוא `"type":"module"` → imports יחסיים ב-`api/`/`server.ts` חייבים סיומת `.js` (למשל `./api/_lib/ai.js`), אחרת Vercel זורק `ERR_MODULE_NOT_FOUND`.

### Deploy (Vercel)
**מודל הענפים (עודכן 2026-08-31 — גרסה 1.0 באוויר):** `main` הוא ה-Production Branch של Vercel ומריץ את **Phase 2 החי** (`holon-edplaner.vercel.app`, v1.0.0, commit `3dc08fb`, מסומן בתג `v1.0.0`). ההקפאה של Phase 1 הסתיימה; הגרסה שקדמה לה מסומנת בתג **`prod-phase1-2026-08-04`** (=`67b2ae3`).

הפיתוח ממשיך על **`phase-2`**; דחיפה אליו בונה **preview בלבד** (`target: null`, מוגן ב-Vercel SSO). `main` מתעדכן רק בריליז מכוון ומאושר.

**⚠️ פרוד ופיתוח חולקים את אותו פרויקט Supabase** (`raifodlpxmseretxbqpn`) — אין מסד נפרד. כלומר כל מיגרציה, כל שינוי תוכן וכל ניסוי נתונים בפיתוח נוגעים **בנתוני בתי ספר חיים**. לפני כל שינוי סכימה או מחיקה: לבדוק מה יש שם בפועל.

**חזרה אחורה — לקרוא לפני שמנסים:** Vercel Instant Rollback ל-`prod-phase1-2026-08-04` הוא **כיבוי חירום, לא שחזור**. לגרסה ההיא אין כניסה עובדת (`checkPassword` מחזיר `false` תמיד) והיא נגישה רק לדפדפן שכבר מחזיק `school_action_plan_v1` ב-localStorage — מפתח ש-Phase 2 מוחק בכניסה הראשונה (`App.tsx`). נתונים שנכתבו ל-Postgres אינם קריאים לה כלל. **המדיניות היא roll forward.**

**איך עושים deploy לפרוד — רק באישור מפורש מהמשתמש:**
1. Vercel → Project → Settings → Environment Variables (Production): להגדיר `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon/publishable בלבד — **לעולם לא** service_role תחת קידומת `VITE_`), וכן `SUPABASE_SERVICE_ROLE_KEY` **בלי** קידומת, לשימוש `api/admin/schools` בלבד. `GEMINI_API_KEY` כבר מוגדר ב-Production.
2. לוודא שכל המיגרציות תחת `supabase/migrations/` הוחלו על פרויקט ה-Supabase שהפרוד מצביע אליו.
3. `npm run lint` (tsc --noEmit) + `npm run build` נקיים; לעדכן `CHANGELOG.md`.
4. למזג `phase-2 → main` ולדחוף עם טוקן הריליז: `ALLOW_PROD_DEPLOY=1 git push origin main` → Vercel עושה auto-deploy אחד לפרוד.
5. לאמת את הפרוד החי (טעינה, לוגין, טעינת עקרונות מה-DB).

**שומר-סף (guard):** git hook מקומי (`pre-push`, מקור ב-`scripts/git-hooks/pre-push`) **חוסם push מקרי ל-`main`** — הדחיפה בשלב 4 דורשת `ALLOW_PROD_DEPLOY=1`. התקנה בקלון חדש: `npm run setup-hooks`. מגן מפני טעות בלבד (עוקף עם `--no-verify`).

`vercel.json`: framework vite, build `vite build`.

## שלבי פיתוח

### Phase 1 — הדמו על Vercel · **הוחלף**
localStorage + ללא auth. רץ בפרוד עד 7.8.2026; מסומן בתג `prod-phase1-2026-08-04`.

### Phase 2 — DB וריבוי בתי ספר · **השלב הנוכחי — גרסה 1.0.0 באוויר בפרוד מ-31.8.2026**
- Supabase מחובר בפיתוח: auth פר בית-ספר (דרופדאון + סיסמה, מאחורי הקלעים session סינתטי) + RLS מלא; פונקציות ההרשאה בסכימה פרטית `app`.
- הגמילה מ-localStorage **הושלמה** — כל מידע דינמי ב-DB, כולל העקרונות ובנק הפעילויות.
- **למנהל המערכת יש כניסה משלו.** ב-`Onboarding` יש מצב `admin` (קישור בתחתית) שמתחבר ל-`ADMIN_EMAIL` (`admin@holon.test`, בפיתוח סיסמה `9999`) על **אותו לקוח `supabase`** הראשי. `App` מנתב לפי `profiles.role`: `city_admin`/`super_admin` מקבלים את `AdminArea` **במקום כל המסע**, ו-bootstrap התוכנית מדולג להם (אין להם `school_id`). אין יותר לקוח Supabase שני.
- **`AdminArea`** = מעטפת בלבד (הדר, לשוניות, באנר הודעות) עם **חמש לשוניות** ב-`src/components/admin/`: `MunicipalDashboard` (ברירת מחדל) · `BankTab` (חיפוש/יצירה/עריכה/מחיקה, פותח `ActivityWizard` גם במצב `editing`) · `PrinciplesTab` (סדר, הסתרה/החזרה, ופתיחת `PrincipleEditor`) · `AudiencesTab` · `SchoolsTab`. שכבת ה-chrome וה-form primitives משותפות ב-`admin/AdminChrome.tsx` ו-`admin/fields.tsx`.
- **`SchoolsTab` הוא היחיד שלא כותב ישירות ל-Supabase** — ראה "ניהול בתי ספר" למטה.
- `useActivityBank()`/`useAudiences()` מוחזקים **ב-`AdminArea`** ומועברים ללשוניות, כדי שמוני הכותרת והלשוניות יראו עותק אחד.
- **אין מחיקה קשה של עיקרון עירוני** — `plan_*` ו-`activity_bank_item_principles` תלויים ב-`principles(id)` עם `on delete cascade`, ומחיקה הייתה הורסת את העבודה של כל 44 בתי הספר. הסתרה = `is_active=false` + חניה ב-`order_index` 90+ ומספור מחדש של הנותרים (מוסכמת `20260805090000`).
  **חריג: עיקרון בית-ספרי כן נמחק לגמרי** (`deleteSchoolPrinciple`). ה-cascade שלו נוגע רק ב-`plan_*` של אותו בית ספר עצמו — הוא לא יכול להיות מקושר לבנק העירוני — ולכן רדיוס ההרס הוא הנתונים של המוחק בלבד, והדיאלוג מפרט אותם במספרים אמיתיים. `is_active=false` היה מותיר שורה שאף אחד לא רואה ואף אחד לא יכול להסיר, שתופסת סלוט לנצח.
- **`order_index` הוא מרחב מספור אחד** לעקרונות עירוניים ובית-ספריים, כי `fetchPrinciples` ממפתח לפיו את `orderToId`/`shortTitles` (ה-id המספרי של ה-UI). לכן הטווחים מופרדים: **עירוני 1..999** (פעילים 1..N, מוסתרים 90+), **בית-ספרי 1000..1001 — שני סלוטים**, ו-`principles_order_scope_ck` אוכף זאת ב-DB (מיגרציות `20260807100000` + `20260807140000`). בלי ההפרדה, העיקרון העירוני הבא היה מקבל את המספר של עיקרון בית-ספרי קיים — אחד היה נדרס במפה, והאבחון היה עלול להיכתב לעיקרון הלא נכון. `principlesAdmin` ממספר מחדש **רק** עקרונות עירוניים.
- **התקרה של 2 עקרונות לבית ספר היא מבנית, לא UI**: `principles_school_slot_uq` (אינדקס ייחודי חלקי על `(school_id, order_index)`) + הטווח `1000..1001`. זה **המקום היחיד** שבו חי המספר 2 — הרחבת התקרה מתחילה בהרחבת ה-CHECK. טריגר סופר לא היה מספיק: הספירה לא מאוחסנת בשום מקום, אז שתי לשוניות ששומרות באותה מילישנייה שתיהן רואות שורה אחת ושתיהן מכניסות. `nextSchoolSlot` מקצה את **הסלוט הפנוי הנמוך ביותר** (לא max+1, שהיה נופל על 1002 אחרי מחיקה).
- **מחיקת עיקרון בית-ספרי משחררת סלוט שהיצירה הבאה תופסת מיד**, ו-`answers`/`principlePlans`/`actionPlan` ממופתחים ב-`order_index` ב-state של React. לכן `handlePrincipleDeleted` ב-`App` **חייב** למחוק את העותקים בזיכרון — אחרת השמירות ה-debounced יצמידו את האבחון והתוכנית של המחוק לעיקרון הבא תוך 700ms.
- **המקרא של `RadarChart` נגזר מרובריקות עירוניות בלבד.** הוא מדפיס שם לרמה רק כשכל הרובריקות שהוזנו לו מסכימות על אותה מחרוזת; אילו ניסוח של בית ספר אחד היה נכנס לחישוב, כל ארבע התוויות היו נעלמות אצל כולם. מאותה סיבה `defaultLevelNames` ממלא ב-wizard את שמות הרמות **מהרובריקות הטעונות** ולא מליטרלים בקוד.
- **`activity_bank_items.position` הוא דירוג בתוך עיקרון**, לא מספר גלובלי — כך זרעה המיגרציה של הבנק וכך `moveBankItem` שומר עליו. ה-UI מציע סידור רק כשהרשימה הנראית **היא** קבוצת העיקרון (סינון לעיקרון אחד, בלי חיפוש).
- **בבנק: הסתרה לפעילות שאומצה, מחיקה רק לפעילות שאיש לא אימץ.** `setActivityActive` להסתרה; `deleteUnadoptedActivity` קורא ל-`public.delete_unadopted_bank_item` (מיגרציה `20260823110000`), פונקציית `security definer` שמוחקת ובודקת `not exists (plan_activities.bank_key = id)` **באותו statement**, כדי שאימוץ בין הספירה בדיאלוג לאישור לא ייפול בין הכיסאות. הסיבה שאין מחיקה לפעילות מאומצת: `plan_activities.bank_key` הוא טקסט בלי FK, אז DELETE לא עושה cascade — אבל הוא כן מוחק את התיעוד של מי שאימץ: שורת האימוץ שורדת עם מפתח שלא מצביע לכלום, `municipalStats` לא סופר אותה כפריט בנק ולא כיוזמה ייחודית, והדשבורד מפיל אותה בשקט. לכן `AdminArea` מחזיק `useActivityBank({ includeInactive: true })` ומעביר אותו ללשוניות ולדשבורד; `byPrinciple` תמיד פעילים בלבד.
- **`SettingsView` הוא רק של בית הספר** — אין בו שום דלת ניהול. הוא כן **יוצר תוכן** מאז הוספת כרטיס "העקרונות הייחודיים של בית הספר" (`SchoolPrincipleWizard`), אבל רק תוכן של בית הספר עצמו: `saveSchoolPrinciple` כותב `scope='school'` עם ה-`school_id` של המחוברת, ו-`app.can_write_scoped` אוכף זאת ב-DB. מנהל עירוני יכול לקרוא עיקרון בית-ספרי ולא לכתוב אותו (`PrinciplesTab` פותח תצוגה לקריאה בלבד).
- **נוסחת הציון ב-`src/lib/scoring.ts` בלבד.** `scoresFor` נותן 1.0 לעיקרון שלא מופה — זו נוחות תצוגה לרדאר ו**אסור** לממצע אותה בין בתי ספר. לאגרגציה יש `mappedScores`, והדשבורד מציג תמיד את מספר בתי הספר שמאחורי כל ממוצע.
- **בית ספר לא כותב לבנק.** הנתיב היחיד שלו הוא "יוזמה ייחודית / אחר" ב-`PlanView`, שמוסיף לתוכנית בית הספר. ה-RLS אוכף את זה — לא רק ה-UI.
- **ניהול בתי ספר — הנתיב היחיד שעובר דרך השרת.** `public.schools` ניתן לכתיבה ל-`super_admin` בלבד (ואין חשבון כזה), והכניסה חיה ב-`auth.users` שאינו חשוף ב-PostgREST. לכן הוספה/שינוי שם/השבתה/איפוס סיסמה עוברים ב-`api/_lib/admin.ts` עם `SUPABASE_SERVICE_ROLE_KEY` (env צד-שרת, **בלי** קידומת `VITE_`), בדפוס של `api/ai/*`: לוגיקה ב-`_lib`, עטיפה דקה ב-`api/admin/schools.ts` (prod) וב-`server.ts` (dev). השרת **לא סומך על הלקוח**: הוא מאמת את ה-JWT מול GoTrue, קורא את `profiles.role` בעצמו, ומגביל כל פעולה לרשות של אותו מנהל.
  - **סיסמאות:** האפליקציה מגדירה את הכלל (4+ תווים), לא GoTrue. יצירת המשתמש עוברת ב-`auth.admin.createUser` (כדי שכל עמודות ה-auth הפנימיות ייכתבו נכון), ומיד אחריה `public.admin_set_school_password()` קובע את הקוד הקצר. הפונקציה `security definer` ומוענקת ל-`service_role` בלבד, ומוגבלת לפרופילים בתפקיד `school`.
  - **מחיקת בית ספר = השבתה בלבד** (`schools.is_active=false` + ban על משתמש ה-auth). `plans`, `plan_*`, `school_files` ו-`profiles` כולם cascade מ-`schools`.
  - `schoolEmail()` ב-`api/_lib/schoolIdentity.ts` — **מקור אמת יחיד** לכתובת הסינתטית, משותף ל-`Onboarding` ולשרת. שתי גרסאות שנסחפות = אף אחד לא נכנס.
- **טרם נבנה:** UI לגרסאות תוכנית (`plans` + `schools.current_plan_id` כבר קיימים).

## כללים קשיחים
- **מפתח AI לעולם לא בצד הלקוח.** היועץ רץ רק דרך `api/_lib/ai.ts` עם env var.
- כל טקסט וכל פריסה — **עברית RTL**.
- **מידע דינמי — ב-DB בלבד.** אין עותקים סטטיים בקוד (לא fallback, לא mock, לא seed חי).
  שינוי **סכימה** = מיגרציה תחת `supabase/migrations/`; מיגרציות משמשות גם לזריעת סביבה חדשה.
  שינוי **תוכן** של עקרונות (כולל הרובריקה והמקורות), בנק הפעילויות וקהלי היעד — נעשה **בזמן ריצה** ע"י המנהל העירוני דרך `AdminArea`, לא במיגרציה. הכתיבות עוברות ב-`src/lib/principlesAdmin.ts`, `activityBankAdmin.ts` ו-`audiencesAdmin.ts`, וה-RLS (`app.can_write_scoped`, `audiences_write`) אוכף אותן.
- מפתח ה-`service_role` של Supabase, כמו `GEMINI_API_KEY`, לעולם לא בצד הלקוח.
- **התפקיד (`profiles.role`) נקבע מ-`raw_app_meta_data` בלבד, לעולם לא מ-`raw_user_meta_data`.** GoTrue נותן ללקוח לכתוב רק `user_metadata` (זה מה ש-`options.data` ב-`signUp()` הופך להיות); ל-`app_metadata` כותב רק ה-admin API עם ה-service_role. עד מיגרציה `20260807140000` הטריגר `app.handle_new_user` קרא מ-`user_metadata`, כלומר בקשת הרשמה אחת עם `{"role":"city_admin"}` ייצרה מנהל עירוני בלי סיסמה. לכן `api/_lib/admin.ts` מעביר `app_metadata: { role, school_id }` ב-`createUser`; `display_name` נשאר ב-`user_metadata` כי הוא תווית ולא הרשאה. משתמש בלי `role` ב-`app_metadata` לא מקבל שורת `profiles` כלל — וזה תקין, כי `app.auth_role()` מחזיר null וכל ה-RLS דוחה.
- **לא לעשות deploy לפרוד בלי אישור מפורש מהמשתמש.**
- כותרת ראשית קבועה בכל המסכים: "הפלנר (Holon School Educational Planner)".

## הסכמות עבודה
- commits קטנים וברורים. העבודה נצברת על ענף `phase-2` (דוחפים חופשי לגיבוי) ומתמזגת ל-`main` רק בריליז מכוון ומאושר — ראה "Deploy (Vercel)". **מ-2026-08-07 הפרוד חי ומשרת בתי ספר אמיתיים**, ולכן מיזוג ל-`main` הוא שינוי שנראה מיד ל-43 מנהלים.
- לדווח לפני שינויים לא-טריוויאליים.
- בעת עדכון מסך שמציג את העקרונות — להשתמש מחדש ב-`PrincipleMenu` ובסדר הקנוני מ-`usePrinciples()`, לא להמציא חדש. אין לקבע את **מספר** העקרונות בטקסט או בקוד: הוא דינמי (לבית ספר עם עיקרון ייחודי יש יותר).

### מתי שינוי גמור (Definition of Done)
שינוי **פונקציונלי** — פיצ'ר חדש **וגם תיקון באג שמשנה התנהגות** — אינו גמור עד שכל הרלוונטי מבין אלה נעשה, באותו קומיט:
1. **קוד עובר lint** — `npm run lint`.
2. **`docs/functional-spec.html`** — מסמך האפיון הפונקציונלי **החי** (עמוד HTML עצמאי, RTL — הוא-הוא מקור ה-Artifact; אין גרסת markdown נפרדת) מעודכן במתחם/סעיף הרלוונטי. זה מסמך בשפת מנהל מוצר ("מה המערכת עושה"), לא ארכיטקטורה. **גם תיקון באג שמשנה התנהגות שנראית למשתמש מחייב עדכון כאן — לא רק פיצ'רים.** אם השינוי מוסיף/מסיר יכולת, מזיז אותה בין מתחמים, משנה כלל שכתוב במסמך, או מקדם פריט מ"הדגמה" ל"פעיל" — לעדכן (כולל טבלת "מה עדיין הדגמה / טרם נבנה"). refactor/ביצועים שלא נראים למשתמש — לא.
3. **`CHANGELOG.md`** — שורה חדשה (ראו `changelog-discipline`).
4. **מספר הגרסה** — `version` ב-`package.json` **חייב להיות זהה** לגרסה העליונה ב-`CHANGELOG.md` ולתג הגרסה ב-`docs/functional-spec.html`. שלושתם משתנים יחד. `App.tsx` ו-`SettingsView.tsx` קוראים את המספר מ-`package.json`, ולכן פער שם מציג למנהל/ת גרסה שגויה במסך "אודות" ובפוטר.
5. **`CLAUDE.md`** — אם השינוי סותר תיאור ארכיטקטורה/כלל שכתוב בו.
6. **תוכן/סכימה** — מיגרציה תחת `supabase/migrations/`.

מסמך האפיון מתפרסם כ-Artifact לקריאה עבור הלקוח (מנהל מוצר), URL קבוע: `https://claude.ai/code/artifact/4f670b38-621b-41ed-820c-afc18dd67032`. אחרי עדכון הקובץ — לפרסם מחדש את **אותו path** (Artifact, עם `url` של הארטיפקט הקיים) כדי לשמור על אותו URL.
