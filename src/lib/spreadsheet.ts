/**
 * Minimal delimited-text parser for the bulk activity import.
 *
 * Deliberately dependency-free: the import accepts CSV (what Google Sheets and Excel
 * both export) and TSV (what copying a block of cells puts on the clipboard), which
 * covers "import a spreadsheet" without pulling a binary .xlsx reader into the bundle.
 * Handles quoted fields, escaped quotes and newlines inside cells.
 */

export type Row = Record<string, string>;

export interface ParsedSheet {
  headers: string[];
  rows: Row[];
}

/** Pick the delimiter by which one appears more often outside quotes on the first line. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/** Split delimited text into a matrix, honouring RFC-4180 style quoting. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const d = delimiter ?? detectDelimiter(clean);

  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); matrix.push(row); row = []; cell = ''; }
    else cell += ch;
  }

  // trailing cell / row (files often lack a final newline)
  if (cell !== '' || row.length) { row.push(cell); matrix.push(row); }

  return matrix.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Parse into headers + keyed rows. The first non-empty line is the header row. */
export function parseSheet(text: string): ParsedSheet {
  const matrix = parseDelimited(text);
  if (!matrix.length) return { headers: [], rows: [] };

  const headers = matrix[0].map((h) => h.trim());
  const rows: Row[] = matrix.slice(1).map((cells) => {
    const row: Row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });

  return { headers, rows };
}

/**
 * Guess which column feeds which field, so the mapping step starts pre-filled.
 * Matching is on normalized Hebrew/English header text, longest hint first.
 */
export const FIELD_HINTS: Record<string, string[]> = {
  // First, so the stable key wins before any looser title match.
  slug: ['מזהה', 'slug', 'id'],
  title: ['שם הפעולה', 'שם הפעילות', 'שם', 'פעולה', 'פעילות', 'title', 'name'],
  short: ['מטרת העל', 'מטרה', 'תקציר', 'goal', 'purpose', 'short'],
  description: ['הסבר קצר על הפעולה', 'הסבר קצר', 'הסבר', 'תיאור', 'description', 'details'],
  metrics: ['מדדי הצלחה ויעדים', 'מדדי הצלחה', 'מדדים', 'יעדים', 'metrics', 'kpi'],
  audienceNote: ['קהל יעד', 'קהל', 'audience'],
  contact: ['למי פונים ברשות', 'למי פונים', 'איש קשר', 'גורם מקצועי', 'contact'],
  principles: ['עיקרון', 'עקרונות', 'principle', 'principles'],
};

const norm = (s: string) => s.replace(/[״"'׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Columns the export writes for the reader's benefit but which cannot be imported
 * back — audiences are stored as slugs plus a free-text note, and the readable
 * rendering cannot be reversed without guessing.
 *
 * The marker is explicit rather than relying on the header wording missing every
 * hint: `FIELD_HINTS.audienceNote` includes the bare word "קהל", which every Hebrew
 * phrasing of "audience" contains, so any wording would auto-map by accident.
 */
export const NO_IMPORT_MARKER = '(לא מיובא)';

export function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const taken = new Set<string>();
  const importable = headers.filter((h) => !h.includes(NO_IMPORT_MARKER));

  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    for (const hint of hints) {
      const match = importable.find(
        (h) => !taken.has(h) && (norm(h) === norm(hint) || norm(h).includes(norm(hint))),
      );
      if (match) { mapping[field] = match; taken.add(match); break; }
    }
  }

  return mapping;
}

// ---- writing ----------------------------------------------------------------

/** RFC-4180: quote when the cell holds a delimiter, a quote or a newline. */
const csvCell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/**
 * Serialize to CSV. CRLF and comma because that is what Excel and Google Sheets both
 * expect, and what `parseDelimited` reads back — one module owns both directions of
 * the contract so a reader and writer can never disagree about quoting.
 */
export function serializeSheet(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * Trigger a download. The BOM is not optional: Excel on Windows reads a BOM-less
 * UTF-8 file as Windows-1255 and renders every Hebrew column as mojibake.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const blob = new Blob(['﻿', serializeSheet(headers, rows)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * `בנק-פעילויות-2026-08-07.csv` — ISO shape so files sort chronologically, but built
 * from local date parts: `toISOString()` is UTC and would stamp yesterday's date on
 * an export taken late at night in Israel.
 */
export const stampedName = (base: string) => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
};
