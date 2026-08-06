import { supabase } from './supabase';
import type { AdminViewer, SaveResult } from './adminAuth';
import type { BankItem } from './activityBank';
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

/** Insert one activity plus its principle links. */
export async function createActivity(
  draft: ActivityDraft,
  viewer: AdminViewer,
  orderToId: Record<number, string>,
): Promise<SaveResult> {
  const principleIds = draft.principles.map((o) => orderToId[o]).filter(Boolean);
  if (!principleIds.length) return { ok: false, error: 'יש לבחור לפחות עיקרון אחד.' };

  const { data, error } = await supabase
    .from('activity_bank_items')
    .insert({
      ...ownerColumns(viewer),
      ...contentColumns(draft),
      category: '',
      slug: '',
      position: 999, // new items sort after the curated list
      is_active: true,
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
  failed: { row: number; title: string; error: string }[];
}

/** Insert many activities; a row that fails does not abort the rest. */
export async function createActivities(
  drafts: ActivityDraft[],
  viewer: AdminViewer,
  orderToId: Record<number, string>,
): Promise<BulkResult> {
  const result: BulkResult = { created: 0, failed: [] };

  for (const [i, draft] of drafts.entries()) {
    const r = await createActivity(draft, viewer, orderToId);
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
): Promise<SaveResult> {
  const want = new Set(draft.principles.map((o) => orderToId[o]).filter(Boolean));
  // An activity linked to no principle is invisible everywhere (see fetchActivityBank),
  // so clearing the last link is a silent delete. Refuse before writing anything.
  if (!want.size) return { ok: false, error: 'יש לבחור לפחות עיקרון אחד.' };

  const { error } = await supabase
    .from('activity_bank_items')
    .update(contentColumns(draft))
    .eq('id', draft.id);

  if (error) return { ok: false, error: error.message };

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

export async function deleteActivity(id: string): Promise<SaveResult> {
  const { error } = await supabase.from('activity_bank_items').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
