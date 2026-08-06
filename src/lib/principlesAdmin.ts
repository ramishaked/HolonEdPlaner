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

/** Where retired principles park, so they never collide with the active 1..N. */
const RETIRED_BASE = 90;

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

const contentColumns = (draft: PrincipleDraft) => ({
  title: draft.title.trim(),
  short_label: draft.shortLabel.trim(),
  icon: draft.icon.trim(),
  color_name: draft.colorName,
  accent_color: draft.accentColor,
  short_summary: draft.shortSummary.trim(),
  rationale: draft.rationale.trim(),
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
 * Create or update a principle with its rubric and sources.
 *
 * Three sequential writes rather than one RPC. The atomic `set_plan_focus` RPC exists
 * to fix a *concurrency* bug (debounced saves interleaving); this editor has one writer
 * behind an explicit save button. The residual risk is a network blip between steps,
 * whose worst outcome is "new narrative text, old rubric text" — coherent, visible on
 * screen, and fixed by pressing save again. Each step reports its own Hebrew error.
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

  // unique(principle_id, level) makes this exact and idempotent — no ids to track.
  const { error: rubricError } = await supabase.from('principle_rubric_levels').upsert(
    draft.levels.map((l) => ({
      principle_id: uuid,
      level: l.level,
      name: l.name.trim(),
      description: l.description.trim(),
    })),
    { onConflict: 'principle_id,level' },
  );
  if (rubricError) {
    return { ok: false, uuid, error: 'תוכן העיקרון נשמר, אך הקריטריונים לא. נסו לשמור שוב.' };
  }

  // Nothing references principle_sources, so replace-in-place turns add / remove /
  // reorder into one code path instead of three.
  const { error: clearError } = await supabase
    .from('principle_sources')
    .delete()
    .eq('principle_id', uuid);
  if (clearError) {
    return { ok: false, uuid, error: 'תוכן העיקרון נשמר, אך המקורות לא עודכנו. נסו לשמור שוב.' };
  }

  const sources = draft.sources.filter((s) => s.title.trim() || s.description.trim() || s.url.trim());
  if (sources.length) {
    const { error: sourceError } = await supabase.from('principle_sources').insert(
      sources.map((s, i) => ({
        principle_id: uuid,
        title: s.title.trim(),
        description: s.description.trim(),
        url: s.url.trim(),
        keywords: s.keywords.trim(),
        order_index: i,
      })),
    );
    if (sourceError) {
      return { ok: false, uuid, error: 'תוכן העיקרון נשמר, אך המקורות לא עודכנו. נסו לשמור שוב.' };
    }
  }

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
