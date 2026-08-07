import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fetchPrinciples } from './principles';
import type { AdminViewer, SaveResult } from './adminAuth';
import type { MaturityLevel, Principle, PrincipleMaturity, Source } from '../types';

/**
 * Write side of the principle set, used by the municipal admin console.
 *
 * RLS (`app.can_write_scoped`) already allows a city admin to insert/update/delete
 * municipal-scope principles, their rubric levels and their sources in its own
 * municipality — so this is a pure client layer, no migration involved.
 *
 * A principle is never hard-deleted. `plan_focus`, `plan_assessments`,
 * `plan_principle_plans`, `plan_activities` and `activity_bank_item_principles` all
 * cascade on `principles(id)`, so a DELETE would destroy every school's work on it.
 * Retirement is `is_active = false`, following the convention set by the
 * 2026-08-05 merge migration: parked at order_index 90+, survivors renumbered 1..N.
 */

/**
 * Where retired principles park, so they never collide with the active 1..N.
 *
 * The whole municipal band is 1..999; a school's own principles occupy the two slots
 * 1000..1001 and are never renumbered here (a city admin may read them but not write
 * them). `principles_order_scope_ck` enforces that split in the DB — the two sets share
 * one order_index space, and an overlap would make two principles answer to the same
 * app-level id.
 */
const RETIRED_BASE = 90;

/**
 * The school band. Mirrors `principles_order_scope_ck` and `principles_school_slot_uq`:
 * a school owns at most two principles, one per slot. Widening the cap means widening
 * the DB CHECK first — these constants follow the schema, they never lead it.
 */
export const SCHOOL_SLOT_BASE = 1000;
export const SCHOOL_PRINCIPLE_SLOTS = 2;

/**
 * Hebrew needs the whole clause, not a number plus a noun: the verb agrees with the
 * count, so "1 בתי ספר מיפו" is wrong twice over. These return finished phrases.
 */
export const schoolsPhrase = (n: number) => (n === 1 ? 'בית ספר אחד' : `${n} בתי ספר`);

export const mappedByPhrase = (n: number) =>
  n === 1 ? 'בית ספר אחד מיפה אותו' : `${n} בתי ספר מיפו אותו`;

export const rankedByPhrase = (n: number) =>
  n === 1
    ? 'בית ספר אחד כבר דירג את עצמו מול הרובריקה הזו'
    : `${n} בתי ספר כבר דירגו את עצמם מול הרובריקה הזו`;

export interface PrincipleDraft {
  /** Absent when creating. */
  uuid?: string;
  orderIndex: number;
  title: string;
  shortLabel: string;
  icon: string;
  colorName: string;
  accentColor: string;
  shortSummary: string;
  rationale: string;
  gapsSolved: string[];
  addedValue: string;
  implementationStrategy: string[];
  sacrificesRequired: string;
  ecosystemPartnerships: string;
  kpis: string[];
  teacherDeliverable: string;
  studentDeliverable: string;
  firstStep: string;
  /** Always four, levels 1..4 — the score formula and the DB CHECK both assume it. */
  levels: MaturityLevel[];
  sources: Source[];
}

const emptyLevels = (): MaturityLevel[] =>
  [1, 2, 3, 4].map((level) => ({ level, name: '', description: '' }));

export const emptyPrincipleDraft = (nextOrderIndex: number): PrincipleDraft => ({
  orderIndex: nextOrderIndex,
  title: '',
  shortLabel: '',
  icon: 'fa-solid fa-lightbulb',
  colorName: 'indigo',
  accentColor: '#6366f1',
  shortSummary: '',
  rationale: '',
  gapsSolved: [],
  addedValue: '',
  implementationStrategy: [],
  sacrificesRequired: '',
  ecosystemPartnerships: '',
  kpis: [],
  teacherDeliverable: '',
  studentDeliverable: '',
  firstStep: '',
  levels: emptyLevels(),
  sources: [],
});

export const draftFromPrinciple = (
  p: Principle,
  rubric?: PrincipleMaturity,
): PrincipleDraft => {
  // Normalise to exactly four levels — a principle seeded without a full rubric would
  // otherwise render a short, ragged editor.
  const byLevel = new Map((rubric?.levels ?? []).map((l) => [l.level, l]));
  const levels = emptyLevels().map((l) => byLevel.get(l.level) ?? l);

  return {
    uuid: p.uuid,
    orderIndex: p.id,
    title: p.title,
    shortLabel: p.shortLabel ?? '',
    icon: p.icon,
    colorName: p.colorName,
    accentColor: p.accentColor,
    shortSummary: p.shortSummary,
    rationale: p.rationale,
    gapsSolved: [...p.gapsSolved],
    addedValue: p.addedValue,
    implementationStrategy: [...p.implementationStrategy],
    sacrificesRequired: p.sacrificesRequired,
    ecosystemPartnerships: p.ecosystemPartnerships,
    kpis: [...p.kpis],
    teacherDeliverable: p.teacherDeliverable,
    studentDeliverable: p.studentDeliverable,
    firstStep: p.firstStep,
    levels,
    sources: p.sources.map((s) => ({ ...s })),
  };
};

/** Identity — what every screen renders as the principle's face. */
const identityColumns = (draft: PrincipleDraft) => ({
  title: draft.title.trim(),
  short_label: draft.shortLabel.trim(),
  icon: draft.icon.trim(),
  color_name: draft.colorName,
  accent_color: draft.accentColor,
});

/** The two narrative fields the lean school wizard offers. */
const narrativeColumns = (draft: PrincipleDraft) => ({
  short_summary: draft.shortSummary.trim(),
  rationale: draft.rationale.trim(),
});

/**
 * What the lean school wizard owns. Deliberately NOT `contentColumns`: sending the empty
 * strings and arrays of fields it never shows would blank anything already stored there,
 * making an edit destructive in a way the principal cannot see on screen.
 */
const leanColumns = (draft: PrincipleDraft) => ({
  ...identityColumns(draft),
  ...narrativeColumns(draft),
});

const contentColumns = (draft: PrincipleDraft) => ({
  ...identityColumns(draft),
  ...narrativeColumns(draft),
  gaps_solved: draft.gapsSolved.map((s) => s.trim()).filter(Boolean),
  added_value: draft.addedValue.trim(),
  implementation_strategy: draft.implementationStrategy.map((s) => s.trim()).filter(Boolean),
  sacrifices_required: draft.sacrificesRequired.trim(),
  ecosystem_partnerships: draft.ecosystemPartnerships.trim(),
  kpis: draft.kpis.map((s) => s.trim()).filter(Boolean),
  teacher_deliverable: draft.teacherDeliverable.trim(),
  student_deliverable: draft.studentDeliverable.trim(),
  first_step: draft.firstStep.trim(),
});

/**
 * Write all four rubric levels.
 *
 * `unique(principle_id, level)` makes the upsert exact and idempotent — no ids to track.
 * Shared by the municipal editor and the school wizard so the two can never disagree
 * about what a rubric level is.
 */
async function saveRubric(uuid: string, levels: MaturityLevel[]): Promise<SaveResult> {
  const { error } = await supabase.from('principle_rubric_levels').upsert(
    levels.map((l) => ({
      principle_id: uuid,
      level: l.level,
      name: l.name.trim(),
      description: l.description.trim(),
    })),
    { onConflict: 'principle_id,level' },
  );
  if (error) return { ok: false, error: 'תוכן העיקרון נשמר, אך הקריטריונים לא. נסו לשמור שוב.' };
  return { ok: true };
}

/**
 * Replace this principle's sources in place.
 *
 * Nothing references `principle_sources`, so delete-then-insert turns add / remove /
 * reorder into one code path instead of three. Municipal only — the school wizard has no
 * sources UI, and calling this from there would silently delete rows it cannot show.
 */
async function saveSources(uuid: string, drafted: Source[]): Promise<SaveResult> {
  const failed = { ok: false as const, error: 'תוכן העיקרון נשמר, אך המקורות לא עודכנו. נסו לשמור שוב.' };

  const { error: clearError } = await supabase
    .from('principle_sources')
    .delete()
    .eq('principle_id', uuid);
  if (clearError) return failed;

  const sources = drafted.filter((s) => s.title.trim() || s.description.trim() || s.url.trim());
  if (!sources.length) return { ok: true };

  const { error } = await supabase.from('principle_sources').insert(
    sources.map((s, i) => ({
      principle_id: uuid,
      title: s.title.trim(),
      description: s.description.trim(),
      url: s.url.trim(),
      keywords: s.keywords.trim(),
      order_index: i,
    })),
  );
  return error ? failed : { ok: true };
}

/**
 * Create or update a MUNICIPAL principle with its rubric and sources.
 *
 * Three sequential writes rather than one RPC. The atomic `set_plan_focus` RPC exists
 * to fix a *concurrency* bug (debounced saves interleaving); this editor has one writer
 * behind an explicit save button. The residual risk is a network blip between steps,
 * whose worst outcome is "new narrative text, old rubric text" — coherent, visible on
 * screen, and fixed by pressing save again. Each step reports its own Hebrew error.
 *
 * The school-side sibling is `saveSchoolPrinciple` below.
 */
export async function savePrinciple(
  draft: PrincipleDraft,
  viewer: AdminViewer,
): Promise<SaveResult & { uuid?: string }> {
  if (draft.title.trim().length < 2) return { ok: false, error: 'יש להזין שם לעיקרון.' };

  let uuid = draft.uuid;

  if (uuid) {
    const { error } = await supabase
      .from('principles')
      .update(contentColumns(draft))
      .eq('id', uuid);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from('principles')
      .insert({
        ...contentColumns(draft),
        // principles_scope_ck: a municipal principle must carry a municipality and no school.
        scope: 'municipal',
        municipality_id: viewer.municipalityId,
        school_id: null,
        order_index: draft.orderIndex,
        is_active: true,
        created_by: viewer.userId,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'שמירת העיקרון נכשלה.' };
    uuid = data.id;
  }

  const rubric = await saveRubric(uuid, draft.levels);
  if (!rubric.ok) return { ...rubric, uuid };

  const sources = await saveSources(uuid, draft.sources);
  if (!sources.ok) return { ...sources, uuid };

  return { ok: true, uuid };
}

export interface PrincipleOrderRow {
  uuid: string;
  orderIndex: number;
  isActive: boolean;
}

/** Writes only the rows whose order or active flag actually changed. */
async function applyOrder(
  next: PrincipleOrderRow[],
  current: PrincipleOrderRow[],
): Promise<SaveResult> {
  const before = new Map(current.map((r) => [r.uuid, r]));

  for (const row of next) {
    const was = before.get(row.uuid);
    if (was && was.orderIndex === row.orderIndex && was.isActive === row.isActive) continue;

    const { error } = await supabase
      .from('principles')
      .update({ order_index: row.orderIndex, is_active: row.isActive })
      .eq('id', row.uuid);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Renumber the active set 1..N and park the retired ones at 90+. */
function renumber(rows: PrincipleOrderRow[]): PrincipleOrderRow[] {
  const active = rows.filter((r) => r.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
  const retired = rows.filter((r) => !r.isActive);
  return [
    ...active.map((r, i) => ({ ...r, orderIndex: i + 1 })),
    ...retired.map((r, i) => ({ ...r, orderIndex: RETIRED_BASE + i })),
  ];
}

/**
 * Hide or restore a principle. A restored one is appended after the active set;
 * a hidden one is parked out of the way and the survivors close the gap.
 *
 * `municipal` must contain only municipal-scope rows — a school-scoped principle is
 * readable by the city admin but not writable, and must never be renumbered here.
 */
export async function setPrincipleActive(
  uuid: string,
  active: boolean,
  municipal: PrincipleOrderRow[],
): Promise<SaveResult> {
  const activeCount = municipal.filter((r) => r.isActive && r.uuid !== uuid).length;
  const next = renumber(
    municipal.map((r) =>
      r.uuid === uuid
        ? { ...r, isActive: active, orderIndex: active ? activeCount + 1 : RETIRED_BASE }
        : r,
    ),
  );
  return applyOrder(next, municipal);
}

/** Move one active principle up or down among the active municipal set. */
export async function movePrinciple(
  uuid: string,
  delta: -1 | 1,
  municipal: PrincipleOrderRow[],
): Promise<SaveResult> {
  const active = municipal.filter((r) => r.isActive).sort((a, b) => a.orderIndex - b.orderIndex);
  const i = active.findIndex((r) => r.uuid === uuid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= active.length) return { ok: true };

  const reordered = [...active];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];

  const next = [
    ...reordered.map((r, k) => ({ ...r, orderIndex: k + 1 })),
    ...municipal.filter((r) => !r.isActive),
  ];
  return applyOrder(renumber(next), municipal);
}

/* ────────────────────────────────────────────────────────────────────────────────
 * The school's own principles.
 *
 * RLS already permits every write below: `app.can_write_scoped` returns true for
 * (scope='school' AND school_id = app.auth_school_id()), and principle_rubric_levels
 * resolves its scope through the parent row. No policy change was needed — only this
 * client layer and the slot constraints from migration 20.
 * ──────────────────────────────────────────────────────────────────────────────── */

export interface SchoolOwner {
  /** profiles.school_id of the signed-in principal — the row's owner. */
  schoolId: string;
  /** auth.uid(), for principles.created_by. */
  userId: string;
}

/** A blank draft for the lean wizard: identity defaults + four named, undescribed levels. */
export const emptySchoolPrincipleDraft = (levelNames: string[]): PrincipleDraft => ({
  ...emptyPrincipleDraft(SCHOOL_SLOT_BASE),
  levels: [1, 2, 3, 4].map((level) => ({
    level,
    name: levelNames[level - 1] ?? '',
    description: '',
  })),
});

/**
 * Level names to pre-fill a new rubric with, taken from the principles already loaded.
 *
 * The radar legend (`RadarChart`) only prints a level's name when every principle that
 * defines it agrees on the exact string, so inventing new wording here would blank the
 * legend the moment the first school saved. Reusing the municipality's own vocabulary
 * keeps it intact and honours the "dynamic content lives in the DB" rule — the literal
 * fallback is for an empty database, not a second copy of live content.
 */
export function defaultLevelNames(rubrics: PrincipleMaturity[]): string[] {
  const FALLBACK = ['מתהווה', 'מתפתח', 'מבוסס', 'מוביל'];

  return [1, 2, 3, 4].map((level) => {
    const names = new Set(
      rubrics
        .map((r) => r.levels.find((l) => l.level === level)?.name.trim())
        .filter((n): n is string => !!n),
    );
    return names.size === 1 ? [...names][0] : FALLBACK[level - 1];
  });
}

/**
 * The lowest free slot for this school, or null when both are taken.
 *
 * Lowest-free rather than max+1: `order_index` is bounded above at 1001, so max+1 after a
 * delete would produce 1002 and be rejected by the CHECK. Reuse is therefore mandatory,
 * not an optimisation — and it is why deleting must also purge the React state keyed by
 * the freed index (see `handlePrincipleDeleted` in App).
 */
export async function nextSchoolSlot(schoolId: string): Promise<number | null> {
  const { data } = await supabase
    .from('principles')
    .select('order_index')
    .eq('scope', 'school')
    .eq('school_id', schoolId);

  const taken = new Set((data ?? []).map((r) => r.order_index));
  for (let i = 0; i < SCHOOL_PRINCIPLE_SLOTS; i++) {
    const slot = SCHOOL_SLOT_BASE + i;
    if (!taken.has(slot)) return slot;
  }
  return null;
}

const CAP_REACHED = `לבית הספר כבר ${SCHOOL_PRINCIPLE_SLOTS} עקרונות ייחודיים.`;

/**
 * Create or update this school's own principle.
 *
 * Writes only the lean wizard's columns, and never touches `principle_sources`: a school
 * principle has no sources UI, and replace-in-place would silently delete rows it cannot
 * show. The DB is the arbiter of the two-slot cap — the pre-flight `nextSchoolSlot` read
 * only buys a better error message; `principles_school_slot_uq` is what actually stops
 * two browser tabs saving in the same millisecond.
 */
export async function saveSchoolPrinciple(
  draft: PrincipleDraft,
  owner: SchoolOwner,
): Promise<SaveResult & { uuid?: string; orderIndex?: number }> {
  if (draft.title.trim().length < 2) return { ok: false, error: 'יש להזין שם לעיקרון.' };

  let uuid = draft.uuid;
  let orderIndex = draft.orderIndex;

  if (uuid) {
    const { error } = await supabase.from('principles').update(leanColumns(draft)).eq('id', uuid);
    if (error) return { ok: false, error: error.message };
  } else {
    const slot = await nextSchoolSlot(owner.schoolId);
    if (slot === null) return { ok: false, error: CAP_REACHED };

    const { data, error } = await supabase
      .from('principles')
      .insert({
        ...leanColumns(draft),
        // principles_scope_ck: a school principle must carry a school.
        scope: 'school',
        municipality_id: null,
        school_id: owner.schoolId,
        order_index: slot,
        is_active: true,
        created_by: owner.userId,
      })
      .select('id, order_index')
      .single();

    if (error || !data) {
      // 23505 = the slot index; 23514 = the range CHECK. Both mean the same thing to the
      // principal, but only the first can happen while she is looking at a "1/2" badge.
      if (error?.code === '23505') {
        return { ok: false, error: 'נוצר בינתיים עיקרון נוסף בחלון אחר. רעננו את הדף ונסו שוב.' };
      }
      if (error?.code === '23514') return { ok: false, error: CAP_REACHED };
      return { ok: false, error: error?.message ?? 'שמירת העיקרון נכשלה.' };
    }

    uuid = data.id;
    orderIndex = data.order_index;
  }

  const rubric = await saveRubric(uuid, draft.levels);
  if (!rubric.ok) return { ...rubric, uuid, orderIndex };

  return { ok: true, uuid, orderIndex };
}

/** What deleting a school principle will destroy — all of it this school's own rows. */
export interface SchoolPrincipleFootprint {
  assessed: boolean;
  activities: number;
  hasVision: boolean;
  focusRoles: string[];
}

export async function schoolPrincipleFootprint(uuid: string): Promise<SchoolPrincipleFootprint> {
  const [assessments, activities, plans, focus] = await Promise.all([
    supabase.from('plan_assessments').select('id').eq('principle_id', uuid),
    supabase.from('plan_activities').select('id').eq('principle_id', uuid),
    supabase.from('plan_principle_plans').select('victory_vision').eq('principle_id', uuid),
    supabase.from('plan_focus').select('role').eq('principle_id', uuid),
  ]);

  return {
    assessed: !!assessments.data?.length,
    activities: activities.data?.length ?? 0,
    hasVision: !!plans.data?.some((r) => r.victory_vision.trim()),
    focusRoles: (focus.data ?? []).map((r) => r.role),
  };
}

/**
 * Hard-delete a school's own principle — unlike a municipal one, which may only be hidden.
 *
 * Everything that cascades (plan_focus, plan_assessments, plan_principle_plans,
 * plan_activities, principle_rubric_levels, principle_sources) belongs to a plan of this
 * same school, so the blast radius is the caller's own data and the confirm dialog names
 * it. `is_active = false` would instead leave an invisible row holding one of the two
 * slots forever, with no UI able to reach it.
 *
 * The freed slot is reused by the next create, so the caller MUST purge the in-memory
 * state keyed by `orderIndex` or the debounced saves will re-attach it to the next one.
 */
export async function deleteSchoolPrinciple(uuid: string): Promise<SaveResult> {
  const { error } = await supabase.from('principles').delete().eq('id', uuid);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * principle uuid → how many schools already saved an assessment against it.
 *
 * Shown before hiding a principle and before rewriting a rubric level, because a
 * stored `selected_maturity_level` is an integer: rewriting level 3's text silently
 * redefines every 3 already saved. A city admin may read every plan in its
 * municipality (`app.can_read_plan`), which is what makes this count possible.
 */
export async function countAssessedSchools(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('plan_assessments').select('plan_id, principle_id');
  if (error || !data) return {};

  const seen = new Map<string, Set<string>>();
  for (const row of data) {
    (seen.get(row.principle_id) ?? seen.set(row.principle_id, new Set()).get(row.principle_id)!)
      .add(row.plan_id);
  }

  const counts: Record<string, number> = {};
  for (const [principleId, plans] of seen) counts[principleId] = plans.size;
  return counts;
}

/**
 * The admin's view of the principle set — the same mapper as the school journey, with
 * the retired rows included so they can be brought back.
 */
export function useAdminPrinciples() {
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [rubrics, setRubrics] = useState<PrincipleMaturity[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPrinciples({ includeInactive: true }).then((data) => {
      if (!alive) return;
      setPrinciples(data?.principles ?? []);
      setRubrics(data?.rubrics ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return { principles, rubrics, loading, reload };
}
