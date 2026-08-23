/**
 * The fillable Excel template for the bulk activity import.
 *
 * Generated on demand from the principles and sources the app currently knows, never
 * shipped as a static file: principle titles are dynamic content the city admin edits
 * at runtime, and a file checked into the repo would hand out yesterday's names.
 */
import { SOURCE_META } from '../planBank';
import type { TaskSource } from '../types';
import { buildXlsx, downloadBlob, type Cell, type SheetSpec } from './xlsxWrite';

export interface TemplatePrinciple {
  title: string;
}

/** Header → width → explanation. Header wording must keep matching `FIELD_HINTS`. */
const COLUMNS: { header: string; width: number; required?: boolean; help: string }[] = [
  { header: 'שם הפעולה', width: 32, required: true, help: 'חובה. שם קצר וברור של הפעילות, כפי שיופיע לבתי הספר.' },
  { header: 'מטרת העל', width: 34, help: 'משפט אחד: מה הפעילות משיגה.' },
  { header: 'הסבר קצר על הפעולה', width: 48, help: '2-3 משפטים: מה עושים בפועל.' },
  { header: 'מדדי הצלחה ויעדים', width: 44, help: 'איך יודעים שהצלחנו: מספרים, תאריכים, תוצרים.' },
  { header: 'קהל יעד', width: 22, help: 'למי הפעילות מיועדת (טקסט חופשי: מנהלת, צוות חינוכי, תלמידי השכבה, כלל התלמידים וכו\').' },
  { header: 'למי פונים ברשות', width: 22, help: 'הגורם ברשות או בפסג"ה שמלווה את הפעילות.' },
  { header: 'מקור הפעילות', width: 16, help: '' /* filled at build time with the live list */ },
  { header: 'עיקרון', width: 40, required: true, help: 'חובה. שם העיקרון מהרשימה הנפתחת. לכמה עקרונות: השמות מופרדים בנקודה-פסיק (;) באותו תא.' },
];

const EXAMPLE_ROW = [
  'סבב ביקורי עמיתים בין-בית-ספרי במרחבי למידה',
  'חשיפת צוותים למודלים שונים של מרחבי למידה גמישים',
  'שלושה בתי ספר מארחים בסבב ביקור של שעתיים: סיור במרחב, שיעור לדוגמה ושיח על מה עבד ומה לא. כל צוות מגיע עם שאלה ממוקדת וחוזר עם רעיון אחד ליישום.',
  '3 ביקורים עד סוף מחצית א\'; כל בית ספר מגדיר שינוי אחד במרחב למידה עד 1.3; סקר שביעות רצון של 80% ומעלה.',
  'צוות חינוכי',
  'פסג"ה חולון',
];

const DATA_ROWS = 200;
const LISTS_SHEET = 'רשימות';

export function buildImportTemplate(principles: TemplatePrinciple[]): Blob {
  const sources = Object.keys(SOURCE_META) as TaskSource[];
  const titles = principles.map((p) => p.title);
  const sourceCol = COLUMNS.findIndex((c) => c.header === 'מקור הפעילות');
  const principleCol = COLUMNS.findIndex((c) => c.header === 'עיקרון');
  const colLetter = (i: number) => String.fromCharCode(65 + i);

  const columns = COLUMNS.map((c) =>
    c.header === 'מקור הפעילות' ? { ...c, help: `אחד מתוך: ${sources.join(' / ')}. ריק = עירוני.` } : c,
  );

  // Example row: the source and principle cells are taken from the live lists so the
  // example never names something the dropdown no longer offers.
  const exampleSource = sources.includes('פסג"ה חולון' as TaskSource) ? 'פסג"ה חולון' : sources[0];
  const example: Cell[] = [
    ...EXAMPLE_ROW.slice(0, 5),
    EXAMPLE_ROW[5],
    exampleSource,
    titles[titles.length - 1] ?? '',
  ].map((v) => ({ v, s: 'example' as const }));

  const blankRow: Cell[] = columns.map(() => ({ v: '', s: 'wrap' }));

  const activities: SheetSpec = {
    name: 'פעילויות',
    colWidths: columns.map((c) => c.width),
    rowHeights: { 1: 30, 2: 95 },
    freezeHeader: true,
    rows: [
      columns.map((c) => ({ v: c.header, s: c.required ? 'headerRequired' : 'header' }) as Cell),
      example,
      ...Array.from({ length: DATA_ROWS - 2 }, () => blankRow),
    ],
    validations: [
      {
        sqref: `${colLetter(principleCol)}2:${colLetter(principleCol)}${DATA_ROWS}`,
        formula: `'${LISTS_SHEET}'!$A$2:$A$${titles.length + 1}`,
        strict: false,
        prompt: 'בחרו מהרשימה. לכמה עקרונות: הקלידו את השמות מופרדים בנקודה-פסיק (;)',
      },
      {
        sqref: `${colLetter(sourceCol)}2:${colLetter(sourceCol)}${DATA_ROWS}`,
        formula: `'${LISTS_SHEET}'!$B$2:$B$${sources.length + 1}`,
        strict: true,
        errorText: 'בחרו מקור מהרשימה.',
      },
    ],
  };

  const listRows: Cell[][] = [[{ v: 'עקרונות', s: 'bold' }, { v: 'מקור', s: 'bold' }]];
  for (let i = 0; i < Math.max(titles.length, sources.length); i++) {
    listRows.push([{ v: titles[i] ?? '' }, { v: sources[i] ?? '' }]);
  }
  const lists: SheetSpec = { name: LISTS_SHEET, colWidths: [40, 16], rows: listRows };

  const guide: SheetSpec = {
    name: 'הנחיות',
    colWidths: [24, 90],
    rows: [
      [{ v: 'הפלנר: טעינת פעילויות לבנק העירוני', s: 'title' }],
      [''],
      [{ v: 'איך ממלאים:', s: 'bold' }],
      ['1. כל שורה בגיליון \'פעילויות\' היא פעילות אחת. השורה הראשונה (הכותרות) נשארת כמו שהיא.'],
      ['2. השורה השנייה היא דוגמה. אפשר למחוק אותה או לדרוס אותה.'],
      ['3. שתי עמודות חובה: \'שם הפעולה\' ו\'עיקרון\'. שאר העמודות רצויות אך לא חוסמות.'],
      ['4. ב\'עיקרון\' וב\'מקור הפעילות\' יש רשימה נפתחת. ב\'מקור\' נא לא להקליד ערכים אחרים.'],
      ['5. פעילות שמתאימה לכמה עקרונות: כותבים בתא \'עיקרון\' את כל השמות מופרדים בנקודה-פסיק, למשל: ' +
        `${titles[2] ?? 'עיקרון א'}; ${titles[4] ?? titles[0] ?? 'עיקרון ב'}. ` +
        'גם שורה נפרדת לכל עיקרון עם אותו שם פעילות תאוחד לפעילות אחת בטעינה.'],
      ['6. שומרים את הקובץ כ-xlsx רגיל ושולחים. אין צורך להמיר ל-CSV.'],
      [''],
      [{ v: 'העמודות:', s: 'bold' }],
      ...columns.map((c) => [{ v: c.header, s: 'bold' as const }, { v: c.help, s: 'wrap' as const }]),
      [''],
      [{ v: 'העקרונות:', s: 'bold' }],
      ...titles.map((t) => [t]),
    ],
  };

  return buildXlsx([activities, lists, guide]);
}

export function downloadImportTemplate(principles: TemplatePrinciple[]) {
  downloadBlob('תבנית-טעינת-פעילויות.xlsx', buildImportTemplate(principles));
}
