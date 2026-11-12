import { createClient } from '@supabase/supabase-js';
import { PICTURE_PAGE_URL } from './pictureSource.js';

/**
 * "התמונה החינוכית" — the data behind the school's tech-matriculation page.
 *
 * Why a server route: the figures for every Holon school sit in one sheet. A principal
 * may see their own school and the city aggregates, never another school by name. The
 * browser therefore must not be told which school to show, and must not receive the
 * other schools' names at all. So this route
 *   1. verifies the session and reads the caller's own school row (through RLS, with
 *      the caller's token: no service_role key involved);
 *   2. takes `schools.picture_name`, the school's name in the sheet. Only the admin
 *      path can write that column (app.lock_school_columns), so a school cannot point
 *      itself at another school's rows;
 *   3. fetches the sheet tabs and replaces every other school's name with an alias.
 *      The numbers stay: the page needs them for the city averages and for the
 *      anonymous comparison chart.
 *
 * The tab list (sheet URL + gids) is read from the dashboard page itself rather than
 * copied here, so a tab added there appears here without a second edit.
 */

export interface PictureTab {
  gid: string;
  name: string;
  csv: string;
}

export interface PictureResult {
  status: number;
  json: { error: string } | { school: string; tabs: PictureTab[] };
}

const err = (status: number, error: string): PictureResult => ({ status, json: { error } });

// Same normalisation as the dashboard's `_strip`: quote marks and whitespace out.
const strip = (v: unknown): string =>
  String(v ?? '').replace(/[׳״'"״׳`]/g, '').replace(/\s+/g, '');

/** Rows that are not schools: header, city reference rows. Kept as they are. */
const NOT_A_SCHOOL = new Set(['ביתספר', 'מקצועות', 'מצבת', 'מצבתבליתלת', 'סהכעיר']);

export function csvParse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  const t = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  row.push(f);
  rows.push(row);
  return rows;
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
export const csvWrite = (rows: string[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\n');

/**
 * Replaces every school name except `own` with a stable alias. One alias map is shared
 * across all tabs, because the page follows each school from one year to the next.
 */
export function anonymise(tabs: PictureTab[], own: string): PictureTab[] {
  const ownKey = strip(own);
  const alias = new Map<string, string>();
  return tabs.map((tab) => {
    const rows = csvParse(tab.csv).map((r) => {
      const key = strip(r[0]);
      if (!key || NOT_A_SCHOOL.has(key) || key === ownKey) return r;
      if (!alias.has(key)) alias.set(key, `בית ספר ${alias.size + 1}`);
      const out = r.slice();
      out[0] = alias.get(key)!;
      return out;
    });
    return { ...tab, csv: csvWrite(rows) };
  });
}

/** Sheet URL and tab list, as declared in the dashboard page source. */
export function readSource(html: string): { pub: string; tabs: { name: string; gid: string }[] } | null {
  const pubDecl = /const PUB\s*=([^;]+);/.exec(html);
  const mapDecl = /const GID_MAP\s*=\s*\{([\s\S]*?)\};/.exec(html);
  if (!pubDecl || !mapDecl) return null;
  const pub = (pubDecl[1].match(/'([^']*)'/g) ?? []).map((s) => s.slice(1, -1)).join('');
  const tabs: { name: string; gid: string }[] = [];
  const pair = /'([^']+)'\s*:\s*'(\d+)'/g;
  for (let m = pair.exec(mapDecl[1]); m; m = pair.exec(mapDecl[1])) tabs.push({ name: m[1], gid: m[2] });
  if (!/^https:\/\/docs\.google\.com\//.test(pub) || !tabs.length) return null;
  return { pub, tabs };
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// The raw sheet is the same for every school, so it is cached per server instance.
// Only the anonymised copy is per caller, and that is never cached.
const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; tabs: PictureTab[] } | null = null;

export async function loadTabs(): Promise<PictureTab[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.tabs;
  const page = process.env.PICTURE_PAGE_URL ?? PICTURE_PAGE_URL;
  const src = readSource(await getText(page + (page.includes('?') ? '&' : '?') + '_=' + Date.now()));
  if (!src) throw new Error('מקור הנתונים לא זוהה בדף הדשבורד');
  const tabs = await Promise.all(
    src.tabs.map(async (t) => {
      const csv = await getText(`${src.pub}?output=csv&single=true&gid=${t.gid}&_=${Date.now()}`);
      if (/^\s*<(!DOCTYPE|html)/i.test(csv)) throw new Error('התקבל HTML במקום CSV');
      return { gid: t.gid, name: t.name, csv };
    }),
  );
  cache = { at: Date.now(), tabs };
  return tabs;
}

export async function picture(authHeader: string | undefined): Promise<PictureResult> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  // Fail closed, like requireUser(): a misconfigured server shows nothing.
  if (!url || !key) return err(500, 'אימות המשתמש אינו זמין: חסרה הגדרת שרת.');

  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return err(401, 'לא מחוברים.');

  // The caller's own token on every query, so RLS decides what this request can read.
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return err(401, 'ההתחברות פגה. היכנסו מחדש.');

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, school_id')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (profileError) return err(500, 'קריאת פרטי המשתמש נכשלה.');
  if (!profile || profile.role !== 'school' || !profile.school_id) {
    return err(403, 'התמונה החינוכית מוצגת לבית ספר בלבד.');
  }

  const { data: school, error: schoolError } = await client
    .from('schools')
    .select('picture_name')
    .eq('id', profile.school_id)
    .maybeSingle();
  if (schoolError) return err(500, 'קריאת פרטי בית הספר נכשלה.');
  const own = (school as { picture_name?: string | null } | null)?.picture_name?.trim();
  if (!own) return err(404, 'לבית הספר הזה אין נתונים בתמונה החינוכית.');

  let tabs: PictureTab[];
  try {
    tabs = await loadTabs();
  } catch (e) {
    return err(502, 'טעינת הנתונים נכשלה: ' + (e instanceof Error ? e.message : String(e)));
  }
  return { status: 200, json: { school: own, tabs: anonymise(tabs, own) } };
}
