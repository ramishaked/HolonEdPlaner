import { supabase } from './supabase';
import type { AdminViewer, SaveResult } from './adminAuth';

/**
 * Write side of the "קהל יעד" picklist, used by the municipal admin console.
 * RLS (`audiences_write`) independently enforces that only that municipality's city
 * admin gets here — this module only fills in the owner column.
 *
 * The slug is opaque and immutable by design. `activity_bank_items.audiences` and
 * `plan_activities.audiences` are `text[]` with no foreign key, so a slug change
 * would silently orphan every row that already carries it. Renaming touches `label`
 * only, which propagates everywhere for free because `audienceLabel()` resolves
 * slug → label at render time.
 */

/** ASCII slug when the label allows one, otherwise an opaque id. Never displayed. */
export function slugForLabel(label: string, taken: Set<string>): string {
  const ascii = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const base = ascii.length >= 2 ? ascii : `aud_${Math.abs(hash(label)).toString(36).slice(0, 6)}`;
  if (!taken.has(base)) return base;

  for (let i = 2; ; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Deterministic so the same Hebrew label maps to the same slug when re-added. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export async function createAudience(
  label: string,
  isOther: boolean,
  viewer: AdminViewer,
  nextPosition: number,
  takenSlugs: Set<string>,
): Promise<SaveResult> {
  const trimmed = label.trim();
  if (trimmed.length < 2) return { ok: false, error: 'יש להזין שם לקהל היעד.' };

  const { error } = await supabase.from('audiences').insert({
    municipality_id: viewer.municipalityId,
    slug: slugForLabel(trimmed, takenSlugs),
    label: trimmed,
    position: nextPosition,
    is_other: isOther,
    is_active: true,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function renameAudience(id: string, label: string): Promise<SaveResult> {
  const trimmed = label.trim();
  if (trimmed.length < 2) return { ok: false, error: 'יש להזין שם לקהל היעד.' };

  const { error } = await supabase.from('audiences').update({ label: trimmed }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * `is_other` is single-select: the wizard asks `audiences.some(a => a.isOther)` to
 * decide whether to prompt for free text, so two catch-alls would be ambiguous.
 * `clearIds` are the rows that currently hold the flag.
 */
export async function setAudienceOther(
  id: string,
  isOther: boolean,
  clearIds: string[],
): Promise<SaveResult> {
  if (isOther && clearIds.length) {
    const { error } = await supabase
      .from('audiences')
      .update({ is_other: false })
      .in('id', clearIds);
    if (error) return { ok: false, error: error.message };
  }

  const { error } = await supabase.from('audiences').update({ is_other: isOther }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setAudienceActive(id: string, active: boolean): Promise<SaveResult> {
  const { error } = await supabase.from('audiences').update({ is_active: active }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Writes the new positions row by row; `position` carries no unique constraint. */
export async function reorderAudiences(
  rows: { id: string; position: number }[],
): Promise<SaveResult> {
  for (const row of rows) {
    const { error } = await supabase
      .from('audiences')
      .update({ position: row.position })
      .eq('id', row.id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface AudienceUsage {
  bank: number;
  plans: number;
}

/**
 * How many rows still reference each slug — shown before deactivating, so the admin
 * knows what they are removing from the pickers. A city admin may read every plan in
 * its municipality (`app.can_read_plan`), which is what makes the second count possible.
 */
export async function countAudienceUsage(): Promise<Record<string, AudienceUsage>> {
  const [bank, plans] = await Promise.all([
    supabase.from('activity_bank_items').select('audiences'),
    supabase.from('plan_activities').select('audiences'),
  ]);

  const usage: Record<string, AudienceUsage> = {};
  const tally = (rows: { audiences: string[] | null }[] | null, key: keyof AudienceUsage) => {
    for (const row of rows ?? []) {
      for (const slug of row.audiences ?? []) {
        (usage[slug] ??= { bank: 0, plans: 0 })[key]++;
      }
    }
  };

  tally(bank.data, 'bank');
  tally(plans.data, 'plans');
  return usage;
}
