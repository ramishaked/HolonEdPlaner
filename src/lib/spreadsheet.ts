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
  title: ['שם הפעולה', 'שם הפעילות', 'שם', 'פעולה', 'פעילות', 'title', 'name'],
  short: ['מטרת העל', 'מטרה', 'תקציר', 'goal', 'purpose', 'short'],
  description: ['הסבר קצר על הפעולה', 'הסבר קצר', 'הסבר', 'תיאור', 'description', 'details'],
  metrics: ['מדדי הצלחה ויעדים', 'מדדי הצלחה', 'מדדים', 'יעדים', 'metrics', 'kpi'],
  audienceNote: ['קהל יעד', 'קהל', 'audience'],
  contact: ['למי פונים ברשות', 'למי פונים', 'איש קשר', 'גורם מקצועי', 'contact'],
  principles: ['עיקרון', 'עקרונות', 'principle', 'principles'],
};

const norm = (s: string) => s.replace(/[״"'׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const taken = new Set<string>();

  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    for (const hint of hints) {
      const match = headers.find(
        (h) => !taken.has(h) && (norm(h) === norm(hint) || norm(h).includes(norm(hint))),
      );
      if (match) { mapping[field] = match; taken.add(match); break; }
    }
  }

  return mapping;
}
