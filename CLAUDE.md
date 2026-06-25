# HolonEdPlaner — CLAUDE.md

## מה זה
כלי למנהלי בתי ספר בחולון: אבחון בשלות מוסדית סביב 7 עקרונות ניהול חינוכי
(רובריקה, מפת עכביש, קנבס תוכנית פעולה, יועץ AI). ממשק עברית, RTL מלא.

## Stack
> למילוי ע"י קלוד קוד אחרי inventory ראשוני (framework, build, package manager).
- Framework:
- Build/Dev:
- Source: נזרע מהדמו של Google AI Studio (`EduPlaner-demo files`).

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
