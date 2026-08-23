// Presentation constants for מתחם התכנון (planning zone).
//
// The bank ITEMS themselves are dynamic content and live in the DB only — see
// `src/lib/activityBank.ts`. What stays here is styling (source → chip theme) and
// the mock metric suggestions, neither of which is per-school data.

import { TaskSource } from './types';

// Task source → chip theme (badge classes + accent hex). Closed vocabulary; the
// chip label IS the source string. Card border + "+" button share the accent.
export const SOURCE_META: Record<TaskSource, { badge: string; accent: string }> = {
  'עירוני': { badge: 'bg-sky-50 text-sky-700 border-sky-100', accent: '#0284c7' },
  'בית ספרי': { badge: 'bg-amber-50 text-amber-700 border-amber-100', accent: '#f59e0b' },
  'פסג"ה חולון': { badge: 'bg-purple-50 text-purple-700 border-purple-100', accent: '#7c3aed' },
  'משרד החינוך': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', accent: '#059669' },
  'ארצי': { badge: 'bg-teal-50 text-teal-700 border-teal-100', accent: '#0d9488' },
  'עולמי': { badge: 'bg-indigo-50 text-indigo-700 border-indigo-100', accent: '#6366f1' },
  'כללי': { badge: 'bg-slate-100 text-slate-600 border-slate-200', accent: '#64748b' },
};

export const sourceMeta = (s: TaskSource) => SOURCE_META[s] ?? SOURCE_META['עירוני'];

// Mock "AI" success-metrics suggestions by category (fallback to 'אחר').
export const METRICS_MOCK: Record<string, string[]> = {
  'בית רותר': [
    'פיתוח והצגת לפחות 3 תוצרים פדגוגיים מבוססי AI המיושמים בשגרת ההוראה, ו-90% שביעות רצון מצוותי ההוראה.',
    'הגשת 4 יוזמות חינוכיות מקוריות בתחום הלמידה המותאמת אישית, פרי תוצרים שפותחו במעבדות.',
  ],
  'סדנת AI': [
    'לפחות 80% מהמורים מדווחים על שימוש שבועי בכלי AI לתכנון שיעורים, פיתוח חומרים ובניית חלופות הערכה.',
    'עלייה של 25% במדד החיבור האנושי מורה–תלמיד, הנובע מחיסכון זמן במטלות שגרתיות.',
  ],
  'האקתון': [
    'הקמת שתי נבחרות חדשנות ופיתוח אב טיפוס אחד לפחות למוצר פדגוגי, והצגתו בהאקתון העירוני.',
    'לפחות 15 מורים מטמיעים שיטת עבודה מואצת מוכוונת פרויקטים (PBL) בכיתות.',
  ],
  'סדנה': [
    'לפחות 80% מהמשתתפים מיישמים את הנלמד בכיתה תוך חודש, עם תוצר אחד מתועד לכל משתתף.',
    'בניית מאגר בית-ספרי של 10 כלים/מערכים פרי הסדנה, זמין לכלל הצוות.',
  ],
  'בית-ספרי': [
    'הטמעת סדירות קבועה במערכת השעות והפעלתה ברצף של מחצית לפחות, עם מעקב ותיעוד.',
    'מדידת השפעה על לפחות 3 כיתות פיילוט והרחבה הדרגתית לכלל השכבה.',
  ],
  'עירוני': [
    'שיתוף פעולה פעיל עם גורם עירוני אחד לפחות והפקת 2 תוצרים משותפים מוצגים בקהילה.',
    'השתתפות נציגות בית-ספרית קבועה במפגשים העירוניים והעברת הידע לצוות.',
  ],
  'קהילה': [
    'הקמת קהילת יישום פעילה של 8–12 משתתפים הנפגשת באופן קבוע ומפתחת תוצרים משותפים.',
    'הצגת התוצרים באירוע קהילתי בית-ספרי בהשתתפות הורים ותלמידים.',
  ],
  'דיגיטלי': [
    'הקמת סביבה/כלי דיגיטלי בית-ספרי בשימוש שוטף של לפחות 70% מהצוות הרלוונטי.',
    'מדידת שימוש חודשית והסקת מסקנות לשיפור מתמשך של הכלי.',
  ],
  'אחר': [
    'הגדרת בעל תפקיד מוביל ומדידת לפחות 4 תוצרי פיתוח פדגוגיים חדשים.',
    'גיבוש אמנה/נוהל בית-ספרי בשיתוף מורים, תלמידים והורים.',
  ],
  'סוכן AI': [
    'השתלבות מהירה של היוזמה בתוכנית הפדגוגית, יצירת 3 קהילות יישום ומדידת אימפקט שבועי.',
    'אימוץ הכלי על ידי 70% מהמשתתפים ויצירת תערוכת תוצרים בית-ספרית.',
  ],
};
