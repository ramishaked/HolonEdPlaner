/**
 * Minimal .xlsx reader for the bulk activity import: first worksheet → string matrix.
 *
 * Still dependency-free, on purpose. An .xlsx is a zip of XML parts, and the browser
 * already ships both halves of what it takes to read one: `DecompressionStream`
 * ('deflate-raw') for the zip entries and `DOMParser` for the XML. A full spreadsheet
 * library would cost more bundle than the whole admin console for a file that only
 * ever holds text cells.
 *
 * Scope: text, numbers and inline/shared strings of the first sheet in workbook order.
 * Formulas yield their cached value, dates yield their serial number (the import has
 * no date column). Anything fancier belongs in CSV.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

/** Read the central directory into a name → entry map. */
function readDirectory(buf: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // The EOCD record sits at the very end (up to 64K of comment may follow it).
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL) throw new Error('bad central directory');
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(buf: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buf);
  const p = entry.localOffset;
  if (view.getUint32(p, true) !== SIG_LOCAL) throw new Error('bad local header');
  const nameLen = view.getUint16(p + 26, true);
  const extraLen = view.getUint16(p + 28, true);
  const start = p + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buf, start, entry.compressedSize);

  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new Error(`unsupported compression ${entry.method}`);

  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readXml(buf: ArrayBuffer, dir: Map<string, ZipEntry>, name: string): Promise<Document | null> {
  const entry = dir.get(name);
  if (!entry) return null;
  const text = new TextDecoder().decode(await inflate(buf, entry));
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** All `<t>` text under a node — plain strings and rich-text runs alike. */
const textOf = (node: Element) =>
  Array.from(node.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');

/** "BC" → 54 (zero-based). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    if (ch < 'A' || ch > 'Z') break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Path of the first sheet in workbook order (sheet1.xml is not guaranteed to be it). */
async function firstSheetPath(buf: ArrayBuffer, dir: Map<string, ZipEntry>): Promise<string> {
  const workbook = await readXml(buf, dir, 'xl/workbook.xml');
  const rels = await readXml(buf, dir, 'xl/_rels/workbook.xml.rels');
  const first = workbook?.getElementsByTagName('sheet')[0];
  const rId = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');

  if (rId && rels) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rId);
    const target = rel?.getAttribute('Target');
    if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  return 'xl/worksheets/sheet1.xml';
}

/**
 * The first worksheet as a matrix of trimmed strings. Empty rows are dropped, and
 * every row is padded to the widest one so callers can index by column safely.
 */
export async function readXlsxMatrix(file: Blob): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const dir = readDirectory(buf);

  const shared: string[] = [];
  const sst = await readXml(buf, dir, 'xl/sharedStrings.xml');
  if (sst) for (const si of Array.from(sst.getElementsByTagName('si'))) shared.push(textOf(si));

  const sheet = await readXml(buf, dir, await firstSheetPath(buf, dir));
  if (!sheet) throw new Error('no worksheet');

  const matrix: string[][] = [];
  for (const rowEl of Array.from(sheet.getElementsByTagName('row'))) {
    const row: string[] = [];
    let cursor = 0;
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : cursor;
      cursor = col + 1;

      const type = c.getAttribute('t');
      let value = '';
      if (type === 's') {
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        value = shared[Number(v)] ?? '';
      } else if (type === 'inlineStr') {
        value = textOf(c);
      } else {
        value = c.getElementsByTagName('v')[0]?.textContent ?? '';
      }

      while (row.length < col) row.push('');
      row[col] = value.trim();
    }
    if (row.some((v) => v !== '')) matrix.push(row);
  }

  const width = Math.max(0, ...matrix.map((r) => r.length));
  return matrix.map((r) => { while (r.length < width) r.push(''); return r; });
}

export const isXlsxName = (name: string) => /\.xlsx$/i.test(name);
