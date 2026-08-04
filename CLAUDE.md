# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## מה זה
כלי למנהלי בתי ספר בחולון: אבחון בשלות מוסדית סביב 7 עקרונות ניהול חינוכי
(רובריקה, מפת עכביש, קנבס תוכנית פעולה, יועץ AI, הפקת מסמך תוכנית עבודה). ממשק עברית, RTL מלא.
מותג: **הפלנר (Holon School Educational Planner)**.

## Stack
- **Framework:** React 19 + TypeScript (entry `src/main.tsx` → `src/App.tsx`), Vite 6 כ-bundler, Tailwind CSS v4 (פלאגין `@tailwindcss/vite`).
- **AI:** Google Gemini (`@google/genai`, model `gemini-2.5-flash`), **צד שרת בלבד** — `GEMINI_API_KEY` נקרא מ-env, לעולם לא נחשף ללקוח. הלקוח קורא רק ל-`/api/ai/*` (מתוך `src/components/DiagnosticView.tsx` — נקודת הקריאה היחידה).
- **Package manager:** npm (`package-lock.json`). Node 24 בסביבה הנוכחית.
- **State:** localStorage בלבד, אין DB (ראה רשימת מפתחות ב-Architecture).
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
- כל zone הוא קומפוננטה ב-`src/components/`: `Onboarding` (כניסה), `OrientView` (היכרות + `PrincipleDetailView`), `DiagnosticView` (אבחון + קריאת AI), `PlanView` (קנבס פעילויות לפי עקרון), `ExportView` (בונה מסמך תוכנית עבודה + ייצוא PDF/Word), `SettingsView` (כרטיס ביקור בית-ספרי + ניהול).

### נתוני הליבה
- `src/data.ts` — `PRINCIPLES_DATA` (7 העקרונות, **לפי הסדר הקנוני id1..id7**) + `MATURITY_RUBRICS`.
- `src/components/PrincipleMenu.tsx` — תפריט העקרונות **האחיד** לכל המסכים (אל תבנו תפריט פר-מסך). `PRINCIPLE_SHORT_TITLES` **נגזר** מ-`PRINCIPLES_DATA` (`p.title`) → **מקור אמת יחיד** לשמות העקרונות בכל המערכת. לשינוי שם עיקרון עורכים רק את `data.ts`. חריג: `RadarChart.tsx` מחזיק `shortLabels` קצרים משלו בשביל מפת העכביש.
- `src/planBank.ts` — בנק הפעילויות לפי עיקרון + `themeFor` (צבעי קטגוריה).

### חישוב ציון בשלות (`App.tsx`)
לכל עיקרון: `(selectedMaturityLevel * 0.7) + (avg(why,how,what) * 0.3)`. עיקרון שטרם מופה → ברירת מחדל 1.0 (אבל מסכים שמבחינים בין "מופה" ל-"רמה 1" צריכים לבדוק `!!answers[id]`, לא רק את הציון).

### localStorage (מקור ה-state היחיד)
`school_diagnostic_answers_v1` (תשובות אבחון), `school_action_plan_v1` (זהות + עוגן/יעדים), `school_diagnostic_ai_result_v1` (דוח AI), `school_principle_plans_v1` (פעילויות `PlanView`), `school_export_config_v1` (בחירת מקטעים ב-`ExportView`), `school_profile_v1` (כרטיס ביקור `SettingsView`), `school_principle_menu_collapsed_v1` (UI). הערה: `PlanView`/`ExportView` קוראים `school_principle_plans_v1` ישירות — לא מורם ל-`App` (חוב עתידי).

### שכבת ה-AI — שני נתיבים, מודול משותף
ההיגיון נמצא ב-`api/_lib/ai.ts` (`initiate`, `generate`). שני wrappers דקים משתמשים בו:
- **dev:** `server.ts` (Express) מייבא ומשרת `/api/ai/*` + `/api/health`.
- **prod (Vercel):** serverless functions ב-`api/ai/initiate.ts`, `api/ai/generate.ts`, `api/health.ts`.
- **ESM gotcha:** `package.json` הוא `"type":"module"` → imports יחסיים ב-`api/`/`server.ts` חייבים סיומת `.js` (למשל `./api/_lib/ai.js`), אחרת Vercel זורק `ERR_MODULE_NOT_FOUND`.

### Deploy (Vercel)
push ל-`origin/main` (github.com/ramishaked/HolonEdPlaner) → auto-deploy לפרוד (`holon-edplaner.vercel.app`). `vercel.json`: framework vite, build `vite build`. `GEMINI_API_KEY` מוגדר ב-Vercel Production בלבד.

## שלבי פיתוח

### Phase 1 — הדמו חי על Vercel (השלב הנוכחי)
- שומרים על **localStorage**, **לא** מכניסים DB.
- **לא** auth אמיתי ו**לא** ריבוי בתי ספר. (קיים מסך כניסה עם דרופדאון בתי-ספר + סיסמה כ-UI stub שתמיד מחזיר "סיסמא לא נכונה" — חוסם session חדש עד Phase 2; session עם בית-ספר שמור ב-localStorage עובר.)
- שינויי לוגיקה מינימליים. DoD: URL חי, פונקציונליות זהה לדמו, RTL תקין בפרוד.

### Phase 2 — DB וריבוי בתי ספר (אחר כך)
- Supabase, ~3 טבלאות ליבה: `schools`, `assessments`, `plans` (+ `profiles` ל-auth).
- גמילה מ-localStorage → CRUD מול Supabase, עיקרון-עיקרון.
- Supabase Auth (magic-link) + RLS: כל מנהל רואה רק את בית ספרו; admin עירוני רואה הכל.

## כללים קשיחים
- **מפתח AI לעולם לא בצד הלקוח.** היועץ רץ רק דרך `api/_lib/ai.ts` עם env var.
- כל טקסט וכל פריסה — **עברית RTL**.
- ב-Phase 1: אין DB, אין auth אמיתי. לא לחרוג מהיקף השלב.
- **לא לעשות deploy לפרוד בלי אישור מפורש מהמשתמש.**
- כותרת ראשית קבועה בכל המסכים: "הפלנר (Holon School Educational Planner)".

## הסכמות עבודה
- commits קטנים וברורים; deploy מוקדם (thin slice) לפני הוספת פיצ'רים.
- לדווח לפני שינויים לא-טריוויאליים.
- בעת עדכון מסך שמציג את 7 העקרונות — להשתמש מחדש ב-`PrincipleMenu` ובסדר הקנוני של `PRINCIPLES_DATA`, לא להמציא חדש.
