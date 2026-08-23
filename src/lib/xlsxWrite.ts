/**
 * Minimal .xlsx writer — the mirror of `./xlsx.ts`, and dependency-free for the same
 * reason. Produces a workbook of text sheets with a handful of cell styles, column
 * widths, a frozen header row and list-type data validations (dropdowns). That is all
 * the import template needs; anything richer belongs to a real spreadsheet library.
 *
 * The zip is written with STORE (no compression): a template is a few KB, and storing
 * avoids pulling a deflate encoder in. CRC-32 is the only arithmetic involved.
 */

export type CellStyle = 'default' | 'header' | 'headerRequired' | 'wrap' | 'bold' | 'example' | 'title';

export interface Cell {
  v: string;
  s?: CellStyle;
}

export interface ListValidation {
  /** Cell range the dropdown applies to, e.g. "H2:H500". */
  sqref: string;
  /** Formula for the list, e.g. "'רשימות'!$A$2:$A$6". */
  formula: string;
  /** true → Excel refuses values outside the list; false → the list is a hint only. */
  strict: boolean;
  prompt?: string;
  errorText?: string;
}

export interface SheetSpec {
  name: string;
  rows: (Cell | string)[][];
  colWidths?: number[];
  rowHeights?: Record<number, number>;
  freezeHeader?: boolean;
  validations?: ListValidation[];
}

const STYLE_INDEX: Record<CellStyle, number> = {
  default: 0,
  header: 1,
  headerRequired: 2,
  wrap: 3,
  bold: 4,
  example: 5,
  title: 6,
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colLetter = (i: number) => {
  let n = i + 1;
  let out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
};

function sheetXml(spec: SheetSpec): string {
  const cols = (spec.colWidths ?? [])
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const rows = spec.rows
    .map((cells, r) => {
      const ht = spec.rowHeights?.[r + 1];
      const attrs = ht ? ` ht="${ht}" customHeight="1"` : '';
      const cs = cells
        .map((cell, c) => {
          const { v, s } = typeof cell === 'string' ? { v: cell, s: undefined } : cell;
          const style = STYLE_INDEX[s ?? 'default'];
          const ref = `${colLetter(c)}${r + 1}`;
          if (v === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
          return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}"${attrs}>${cs}</row>`;
    })
    .join('');

  const pane = spec.freezeHeader
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    : '';

  const validations = spec.validations?.length
    ? `<dataValidations count="${spec.validations.length}">` +
      spec.validations
        .map((dv) => {
          const a = [
            'type="list"',
            'allowBlank="1"',
            `showErrorMessage="${dv.strict ? 1 : 0}"`,
            dv.prompt ? `showInputMessage="1" prompt="${esc(dv.prompt)}"` : '',
            dv.strict && dv.errorText ? `errorStyle="stop" error="${esc(dv.errorText)}"` : '',
            `sqref="${dv.sqref}"`,
          ].filter(Boolean).join(' ');
          return `<dataValidation ${a}><formula1>${esc(dv.formula)}</formula1></dataValidation>`;
        })
        .join('') +
      '</dataValidations>'
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0">${pane}</sheetView></sheetViews>` +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${rows}</sheetData>` +
    validations +
    '</worksheet>'
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="5">' +
  '<font><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><name val="Arial"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF475569"/><name val="Arial"/></font>' +
  '<font><b/><sz val="14"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF9A3412"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border>' +
  '<left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right>' +
  '<top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/>' +
  '</border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  // 0 default
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  // 1 header
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>' +
  // 2 header required
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1" readingOrder="2"/></xf>' +
  // 3 wrap
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1" readingOrder="2"/></xf>' +
  // 4 bold
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  // 5 example
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1" readingOrder="2"/></xf>' +
  // 6 title
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function workbookParts(sheets: SheetSpec[]): Record<string, string> {
  const parts: Record<string, string> = {};

  parts['[Content_Types].xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('') +
    '</Types>';

  parts['_rels/.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  parts['xl/workbook.xml'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  parts['xl/_rels/workbook.xml.rels'] =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  parts['xl/styles.xml'] = STYLES_XML;
  sheets.forEach((s, i) => { parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });

  return parts;
}

// ---- zip (STORE) -------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: Record<string, string>): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  // Fixed DOS timestamp (2026-01-01 00:00) — a template has no meaningful mtime and a
  // constant keeps the output byte-stable across downloads.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);

    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(Object.keys(files).length), ...u16(Object.keys(files).length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...chunks, ...central, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Build a workbook and return it as a Blob ready to download. */
export const buildXlsx = (sheets: SheetSpec[]): Blob => zipStore(workbookParts(sheets));

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
