import { supabase } from './supabase';
import type { AdminViewer, SaveResult } from './adminAuth';
import type { BankItem } from './activityBank';
import { normalizeTitle } from './similarity';
export { normalizeTitle, similarity, findSimilar, type DuplicateHit } from './similarity';
export type { SaveResult } from './adminAuth';
import type { TaskSource } from '../types';

/**
 * Write side of the activity bank, used by the admin wizard.
 *
 * Only a signed-in city admin reaches this code, and RLS enforces that independently —
 * a school session attempting a municipal insert is rejected by the database, not by
 * the UI. This module only fills in the correct owner columns.
 */

export interface ActivityDraft {
  /** Present when editing an existing item. */
  id?: string;
  /** Only set by the spreadsheet import — the stable key it matches rows on. */
  slug?: string;
  title: string;
  short: string;
  description: string;
  metrics: string;
  contact: string;
  source: TaskSource;
  audiences: string[];
  audienceNote: string;
  /** UI principle ids (order_index). At least one. */
  principles: number[];
}

/** Seed the wizard from an existing bank row, for edit mode. */
export const draftFromBankItem = (item: BankItem): ActivityDraft & { id: string } => ({
  id: item.key,
  title: item.title,
  short: item.short,
  description: item.description,
  metrics: item.metrics,
  contact: item.contact,
  source: item.source,
  audiences: item.audiences,
  audienceNote: item.audienceNote,
  principles: item.principles,
});

export const emptyDraft = (): ActivityDraft => ({
  title: '',
  short: '',
  description: '',
  metrics: '',
  contact: '',
  source: 'עירוני',
  audiences: [],
  audienceNote: '',
  principles: [],
});

// ---- writes -----------------------------------------------------------------

// Wizard activities are always municipal: only a city admin can reach the wizard, and
// what it produces is meant to appear for every school in the municipality. A school
// adds its own activity from the planning zone ("יוזמה ייחודית"), not from here.
const ownerColumns = (viewer: AdminViewer) => ({
  scope: 'municipal' as const,
  municipality_id: viewer.municipalityId,
  school_id: null,
});

/** The columns the wizard owns. Everything else (owner, category, slug, position,
 *  is_active) is set at creation and never rewritten by an edit. */
const contentColumns = (draft: ActivityDraft) => ({
  title: draft.title.trim(),
  short: draft.short.trim(),
  description: draft.description.trim(),
  metrics: draft.metrics.trim(),
  contact: draft.contact.trim(),
  source: draft.source,
  audiences: draft.audiences,
  audience_note: draft.audienceNote.trim(),
});

type ContentColumns = ReturnType<typeof contentColumns>;

/**
 * Only the columns whose sheet column the admin actually mapped.
 *
 * A spreadsheet update must not blank the fields it does not carry: the import builds
 * every row from `emptyDraft()`, so an unmapped column arrives as '' and a full write
 * would silently erase it. A mapped-but-empty cell *is* written empty — that is how a
 * field gets cleared.
 */
const contentColumnsFor = (draft: ActivityDraft, fields?: Set<string>) => {
  const all = contentColumns(draft);
  if (!fields) return all;

  const pick = <K extends keyof ContentColumns>(field: string, key: K) =>
    (fields.has(field) ? { [key]: all[key] } : {}) as Partial<Pick<ContentColumns, K>>;

  return {
    ...pick('title', 'title'),
    ...pick('short', 'short'),
    ...pick('description', 'description'),
    ...pick('metrics', 'metrics'),
    ...pick('contact', 'contact'),
    ...pick('audienceNote', 'audience_note'),
    ...pick('source', 'source'),
    ...pick('audiences', 'audiences'),
  };
};

/** Opaque and content-independent, so renaming an activity never moves its key. */
const slugForId = (id: string) => `act_${id.replace(/-/g, '').slice(0, 12)}`;

/**
 * Rank for a brand-new activity: last inside its first principle group. Computed from
 * the bank already in memory — the alternative was the old hardcoded 999, which piled
 * every new item onto the same number and made `position` meaningless.
 */
export function nextPositionFor(principleOrders: number[], bank: Record<number, BankItem[]>) {
  const group = bank[principleOrders[0]] ?? [];
  return Math.max(0, ...group.map((i) => i.position)) + 1;
}

/** Insert one activity plus its principle links. */
export async function createActivity(
  draft: ActivityDraft,
  viewer: AdminViewer,
  orderToId: Record<number, string>,
  position = 1,
): Promise<SaveResult> {
  const principleIds = draft.principles.map((o) => orderToId[o]).filter(Boolean);
  if (!principleIds.length) return { ok: false, error: 'יש לבחור לפחות עיקרון אחד.' };

  // The id is minted here so the slug can be derived from it in the same insert,
  // instead of a follow-up update that could fail and leave a keyless row.
  const id = crypto.randomUUID();

  const { data, error } = await supabase
    .from('activity_bank_items')
    .insert({
      id,
      ...ownerColumns(viewer),
      ...contentColumns(draft),
      category: '',
      slug: slugForId(id),
      position,
      is_active: true,
      created_by: viewer.userId,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'שמירת הפעילות נכשלה.' };

  const { error: linkError } = await supabase
    .from('activity_bank_item_principles')
    .insert(principleIds.map((principle_id) => ({ item_id: data.id, principle_id })));

  if (linkError) {
    // Don't leave an activity that belongs to no principle — it would be invisible.
    await supabase.from('activity_bank_items').delete().eq('id', data.id);
    return { ok: false, error: 'שיוך הפעילות לעקרונות נכשל, והפעילות לא נשמרה.' };
  }

  return { ok: true };
}

export interface BulkResult {
  created: number;
  updated: number;
  failed: { row: number; title: string; error: string }[];
}

/** What an imported row resolved to before anything is written. */
export interface ImportMatch {
  match: BankItem | null;
  /** Two existing activities share this title — the importer refuses to guess. */
  ambiguous?: boolean;
}

/**
 * Decide whether a sheet row updates an existing activity or creates a new one.
 *
 * The slug wins when the sheet carries one, because the title is precisely the field
 * most likely to be corrected in the sheet — matching on it alone would either miss
 * the row or, worse, overwrite a different one. A slug the bank does not know is
 * treated as a new row rather than an error; a duplicate title is refused outright.
 */
export function matchImportRow(draft: ActivityDraft, existing: BankItem[]): ImportMatch {
  const municipal = existing.filter((i) => i.scope === 'municipal');

  const slug = draft.slug?.trim();
  if (slug) return { match: municipal.find((i) => i.slug === slug) ?? null };

  const wanted = normalizeTitle(draft.title);
  if (!wanted) return { match: null };

  const byTitle = municipal.filter((i) => normalizeTitle(i.title) === wanted);
  if (byTitle.length > 1) return { match: null, ambiguous: true };
  return { match: byTitle[0] ?? null };
}

export interface ImportRow {
  draft: ActivityDraft;
  match: BankItem | null;
}

/**
 * Import many rows: matched ones are updated in place, the rest created. A row that
 * fails does not abort the rest.
 *
 * `fields` is the set of draft fields the admin actually mapped — an update writes
 * only those. `linkPrinciples` is false when the sheet has no principle column, in
 * which case existing links are left alone.
 */
export async function upsertActivities(
  rows: ImportRow[],
  viewer: AdminViewer,
  orderToId: Record<number, string>,
  bank: Record<number, BankItem[]>,
  opts: { fields: Set<string>; linkPrinciples: boolean },
): Promise<BulkResult> {
  const result: BulkResult = { created: 0, updated: 0, failed: [] };
  // Each new row lands after the previous one instead of all sharing a rank.
  const nextByPrinciple: Record<number, number> = {};

  for (const [i, row] of rows.entries()) {
    const { draft, match } = row;

    if (match) {
      const r = await updateActivity({ ...draft, id: match.key }, orderToId, opts);
      if (r.ok) result.updated++;
      else result.failed.push({ row: i + 1, title: draft.title, error: r.error ?? 'שגיאה' });
      continue;
    }

    const group = draft.principles[0];
    nextByPrinciple[group] ??= nextPositionFor(draft.principles, bank);
    const r = await createActivity(draft, viewer, orderToId, nextByPrinciple[group]++);
    if (r.ok) result.created++;
    else result.failed.push({ row: i + 1, title: draft.title, error: r.error ?? 'שגיאה' });
  }

  return result;
}

/**
 * Update one activity's content and re-diff its principle links.
 *
 * No `viewer`: an edit never rewrites the owner columns, and RLS gates the row anyway —
 * a school session cannot touch a municipal item however the client is called.
 */
export async function updateActivity(
  draft: ActivityDraft & { id: string },
  orderToId: Record<number, string>,
  opts: { fields?: Set<string>; linkPrinciples?: boolean } = {},
): Promise<SaveResult> {
  // The spreadsheet path may carry no principle column at all; a correction sheet must
  // not strip every link and make the activity invisible.
  const linkPrinciples = opts.linkPrinciples !== false;
  const want = new Set(draft.principles.map((o) => orderToId[o]).filter(Boolean));
  // An activity linked to no principle is invisible everywhere (see fetchActivityBank),
  // so clearing the last link is a silent delete. Refuse before writing anything.
  if (linkPrinciples && !want.size) return { ok: false, error: 'יש לבחור לפחות עיקרון אחד.' };

  const { error } = await supabase
    .from('activity_bank_items')
    .update(contentColumnsFor(draft, opts.fields))
    .eq('id', draft.id);

  if (error) return { ok: false, error: error.message };
  if (!linkPrinciples) return { ok: true };

  // Read the links back rather than trusting the client's copy — a second admin tab
  // may have changed them since this wizard opened.
  const { data: links, error: readError } = await supabase
    .from('activity_bank_item_principles')
    .select('principle_id')
    .eq('item_id', draft.id);

  if (readError) return { ok: false, error: 'התוכן נשמר, אך שיוך העקרונות לא עודכן. נסו שוב.' };

  const have = new Set((links ?? []).map((l) => l.principle_id));
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));

  // Add before removing: a failure between the two leaves the item over-linked
  // (visible under an extra principle) rather than invisible. Retry fixes it.
  if (toAdd.length) {
    const { error: addError } = await supabase
      .from('activity_bank_item_principles')
      .insert(toAdd.map((principle_id) => ({ item_id: draft.id, principle_id })));
    if (addError) return { ok: false, error: 'התוכן נשמר, אך שיוך העקרונות לא עודכן. נסו שוב.' };
  }

  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from('activity_bank_item_principles')
      .delete()
      .eq('item_id', draft.id)
      .in('principle_id', toRemove);
    if (removeError) return { ok: false, error: 'התוכן נשמר, אך ניתוק העקרונות לא הושלם. נסו שוב.' };
  }

  return { ok: true };
}

/**
 * Move one activity within its principle group.
 *
 * `group` is the list the admin is looking at — active municipal items of one
 * principle, in display order. Only rows whose rank actually changed are written;
 * `position` carries no unique constraint, so there is no temporary-value dance.
 */
export async function moveBankItem(
  id: string,
  target: -1 | 1 | 'top',
  group: BankItem[],
): Promise<SaveResult> {
  const i = group.findIndex((item) => item.key === id);
  if (i < 0) return { ok: true };

  const next = [...group];
  if (target === 'top') {
    if (i === 0) return { ok: true };
    next.splice(0, 0, ...next.splice(i, 1));
  } else {
    const j = i + target;
    if (j < 0 || j >= next.length) return { ok: true };
    [next[i], next[j]] = [next[j], next[i]];
  }

  for (const [index, item] of next.entries()) {
    const position = index + 1;
    if (item.position === position) continue;

    const { error } = await supabase
      .from('activity_bank_items')
      .update({ position })
      .eq('id', item.key);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

/**
 * Hide or restore an activity. There is deliberately no hard delete.
 *
 * `plan_activities.bank_key` is plain text with no FK, so a DELETE does not cascade —
 * but it does erase the city's record of who adopted the activity: the uptake row
 * survives with a key pointing at nothing, `municipalStats` counts it as neither a
 * bank item nor a custom one, and the dashboard drops it silently. Hiding keeps that
 * record, and matches how principles, audiences and schools already behave.
 */
export async function setActivityActive(id: string, active: boolean): Promise<SaveResult> {
  const { error } = await supabase
    .from('activity_bank_items')
    .update({ is_active: active })
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
