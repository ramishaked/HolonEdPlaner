# HolonEdPlaner — CLAUDE.md

## מה זה
כלי למנהלי בתי ספר בחולון: אבחון בשלות מוסדית סביב 7 עקרונות ניהול חינוכי
(רובריקה, מפת עכביש, קנבס תוכנית פעולה, יועץ AI). ממשק עברית, RTL מלא.

## Stack
- **Framework:** React 19 + TypeScript (entry `src/main.tsx` → `src/App.tsx`), Vite 6 כ-bundler, Tailwind CSS v4 (פלאגין `@tailwindcss/vite`).
- **Server:** Express (`server.ts`) שמשרת את האפליקציה — ב-dev דרך Vite middleware, ב-prod מתוך `dist/`. כולל endpoints ל-AI (`/api/ai/initiate`, `/api/ai/generate`) + `/api/health`. רץ על פורט 3000.
- **AI:** Google Gemini דרך `@google/genai`, **צד שרת בלבד** — `GEMINI_API_KEY` נקרא מ-env ב-`server.ts` ולא נחשף ללקוח. הלקוח קורא רק ל-`/api/ai/*` (ב-`src/components/DiagnosticView.tsx`). תואם לכלל הקשיח.
- **Package manager:** npm (`package-lock.json`). Node 24 בסביבה הנוכחית.
- **State:** localStorage בלבד (מפתחות `school_diagnostic_answers_v1`, `school_action_plan_v1`, `school_diagnostic_ai_result_v1`). אין DB.
- **UI libs:** lucide-react, react-markdown, motion; פונטים ו-FontAwesome מ-CDN ב-`index.html`.
- **Source:** נזרע מהדמו של Google AI Studio (`EduPlaner-demo files`).

### הרצה מקומית
- `npm install`
- מפתח AI: להגדיר `GEMINI_API_KEY` ב-`.env.local` (ראה `.env.example`). האפליקציה עולה גם בלי המפתח — רק פיצ'רי ה-AI יחזירו שגיאה 500 מנוסחת.
- `npm run dev` → http://localhost:3000 (`tsx server.ts`).
- בדיקות: `npm run lint` (`tsc --noEmit`). build: `npm run build` (Vite build + esbuild bundle של השרת ל-`dist/server.cjs`); `npm start` מריץ את ה-build בפרוד.

## שלבי פיתוח

### Phase 1 — להעלות את הדמו לאוויר כמו שהוא (השלב הנוכחי)
מטרה: אותה פונקציונליות בדיוק, חיה על Vercel.
- שומרים על **localStorage** כפי שהוא. **לא** מכניסים DB.
- **לא** מוסיפים auth ו**לא** ריבוי בתי ספר.
- שינויי לוגיקה מינימליים — רק מה שנדרש כדי שייבנה ויעלה לפרוד.
- Definition of done: URL חי ב-Vercel, פונקציונליות זהה לדמו, RTL תקין בפרוד.

### Phase 2 — חיבור DB וריבוי בתי ספר (אחר כך)
- Supabase, ~3 טבלאות ליבה: `schools`, `assessments`, `plans` (+ `profiles` לשכבת auth).
- גמילה מ-localStorage → CRUD מול Supabase, עיקרון-עיקרון.
- Supabase Auth (magic-link) + RLS: כל מנהל רואה רק את בית ספרו; admin עירוני רואה הכל.

## כללים קשיחים
- **מפתח AI לעולם לא בצד הלקוח.** היועץ חייב לרוץ דרך serverless function עם env var.
  אם הדמו קורא ל-Gemini מהדפדפן — לזהות ולהציע תיקון.
- כל טקסט וכל פריסה — עברית RTL.
- ב-Phase 1: אין DB, אין auth. לא לחרוג מהיקף השלב.

## הסכמות עבודה
- commits קטנים וברורים.
- deploy מוקדם (thin slice) לפני הוספת פיצ'רים.
- לדווח לפני שינויים לא-טריוויאליים.
