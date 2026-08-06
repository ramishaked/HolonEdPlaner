import { supabase } from './supabase';
import type { AdminViewer } from './adminAuth';
export { normalizeTitle, similarity, findSimilar, type DuplicateHit } from './similarity';
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

export interface SaveResult {
  ok: boolean;
  /** Hebrew message when the write failed, for display. */
  error?: string;
}

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
      title: draft.title.trim(),
      short: draft.short.trim(),
      description: draft.description.trim(),
      metrics: draft.metrics.trim(),
      contact: draft.contact.trim(),
      source: draft.source,
      audiences: draft.audiences,
      audience_note: draft.audienceNote.trim(),
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

export async function deleteActivity(id: string): Promise<SaveResult> {
  const { error } = await supabase.from('activity_bank_items').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
