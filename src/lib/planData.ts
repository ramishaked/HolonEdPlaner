import { supabase } from './supabase';
import type {
  ActionPlan,
  DiagnosticAnswers,
  DiagnosticResponse,
  PrinciplePlan,
  SchoolFileMeta,
} from '../types';

/**
 * DB-backed persistence for a school's work plan (Phase 2).
 *
 * Everything hangs off one `plans` row = a named planning version. This module
 * resolves/creates the school's current version and round-trips the assessment
 * (mapping) + the action-plan fields onto it.
 *
 * Principle ids: the UI uses the numeric `order_index`; the DB uses uuids. The
 * caller passes the `orderToId` map from usePrinciples() to translate.
 */

export const DEFAULT_PLAN_NAME = 'תוכנית ראשית';

export interface PlanContext {
  planId: string;
  schoolId: string;
}

/** Resolve the signed-in school's current plan, creating a default one if needed. */
export async function ensureCurrentPlan(userId: string): Promise<PlanContext | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', userId)
    .single();

  const schoolId = profile?.school_id;
  if (!schoolId) return null;

  const { data: school } = await supabase
    .from('schools')
    .select('current_plan_id')
    .eq('id', schoolId)
    .single();

  // 1) the school's explicitly-loaded version
  if (school?.current_plan_id) {
    return { planId: school.current_plan_id, schoolId };
  }

  // 2) any existing version (oldest first — the original)
  const { data: existing } = await supabase
    .from('plans')
    .select('id')
    .eq('school_id', schoolId)
    .order('created_at')
    .limit(1);

  if (existing && existing.length) {
    const planId = existing[0].id;
    await supabase.from('schools').update({ current_plan_id: planId }).eq('id', schoolId);
    return { planId, schoolId };
  }

  // 3) first run for this school — create the default version
  const { data: created, error } = await supabase
    .from('plans')
    .insert({ school_id: schoolId, name: DEFAULT_PLAN_NAME, status: 'active' })
    .select('id')
    .single();

  if (error || !created) return null;
  await supabase.from('schools').update({ current_plan_id: created.id }).eq('id', schoolId);
  return { planId: created.id, schoolId };
}

// ---- assessments (the mapping) ---------------------------------------------

/** Load the version's assessment answers, keyed by the UI's numeric principle id. */
export async function loadAssessments(
  planId: string,
  idToOrder: Record<string, number>,
): Promise<DiagnosticAnswers> {
  const { data } = await supabase
    .from('plan_assessments')
    .select('principle_id, why_score, how_score, what_score, selected_maturity_level, evidence')
    .eq('plan_id', planId);

  const answers: DiagnosticAnswers = {};
  for (const row of data ?? []) {
    const order = idToOrder[row.principle_id];
    if (order === undefined) continue; // principle no longer visible to this school
    answers[order] = {
      whyScore: row.why_score,
      howScore: row.how_score,
      whatScore: row.what_score,
      selectedMaturityLevel: row.selected_maturity_level,
      evidence: row.evidence,
    };
  }
  return answers;
}

/** Upsert a single principle's assessment row. */
export async function saveAssessment(
  planId: string,
  principleUuid: string,
  r: DiagnosticResponse,
): Promise<void> {
  await supabase.from('plan_assessments').upsert(
    {
      plan_id: planId,
      principle_id: principleUuid,
      why_score: r.whyScore,
      how_score: r.howScore,
      what_score: r.whatScore,
      selected_maturity_level: r.selectedMaturityLevel,
      evidence: r.evidence,
    },
    { onConflict: 'plan_id,principle_id' },
  );
}

// ---- action plan (version-level fields + focus anchors) ---------------------

export interface LoadedActionPlan {
  schoolYear: string;
  organizationalSacrifice: string;
  strengthReason: string;
  breakthroughReason1: string;
  breakthroughReason2: string;
  strengths: number[];
  breakthroughs: number[];
}

export async function loadActionPlan(
  planId: string,
  idToOrder: Record<string, number>,
): Promise<LoadedActionPlan | null> {
  const { data: plan } = await supabase
    .from('plans')
    .select('school_year, organizational_sacrifice, strength_reason, breakthrough_reason1, breakthrough_reason2')
    .eq('id', planId)
    .single();

  if (!plan) return null;

  const { data: focus } = await supabase
    .from('plan_focus')
    .select('principle_id, role, position')
    .eq('plan_id', planId)
    .order('position');

  const strengths: number[] = [];
  const breakthroughs: number[] = [];
  for (const f of focus ?? []) {
    const order = idToOrder[f.principle_id];
    if (order === undefined) continue;
    (f.role === 'strength' ? strengths : breakthroughs).push(order);
  }

  return {
    schoolYear: plan.school_year,
    organizationalSacrifice: plan.organizational_sacrifice,
    strengthReason: plan.strength_reason,
    breakthroughReason1: plan.breakthrough_reason1,
    breakthroughReason2: plan.breakthrough_reason2,
    strengths,
    breakthroughs,
  };
}

/** Persist the version-level action-plan fields (text) — called debounced. */
export async function saveActionPlanFields(planId: string, a: ActionPlan): Promise<void> {
  await supabase
    .from('plans')
    .update({
      school_year: a.schoolYear ?? '',
      organizational_sacrifice: a.organizationalSacrifice ?? '',
      strength_reason: a.strengthReason ?? '',
      breakthrough_reason1: a.breakthroughReason1 ?? '',
      breakthrough_reason2: a.breakthroughReason2 ?? '',
    })
    .eq('id', planId);
}

/**
 * Replace the focus anchors (strength / breakthroughs) for this version.
 *
 * Goes through the `set_plan_focus` function rather than delete-then-insert from here:
 * the two statements have to be one transaction. As separate requests, two debounced
 * saves overlapping produced `A-delete, B-delete, A-insert, B-insert`, where B's insert
 * collided with A's rows on unique (plan_id, principle_id, role) — a 409, and possibly
 * the older selection left behind.
 */
export async function saveFocus(
  planId: string,
  strengths: number[],
  breakthroughs: number[],
  orderToId: Record<number, string>,
): Promise<void> {
  const focus = [
    ...strengths.map((order, i) => ({ role: 'strength', order, position: i })),
    ...breakthroughs.map((order, i) => ({ role: 'breakthrough', order, position: i })),
  ]
    .filter((r) => orderToId[r.order])
    .map((r) => ({
      principle_id: orderToId[r.order],
      role: r.role,
      position: r.position,
    }));

  await supabase.rpc('set_plan_focus', { p_plan_id: planId, p_focus: focus });
}

// ---- per-principle plans + activities (מתחם התכנון) -------------------------

/**
 * Activity ids are DB uuids: PlanView mints them with crypto.randomUUID() so a
 * row maps 1:1 to its React item and can be upserted rather than delete-inserted.
 */
export async function loadPrinciplePlans(
  planId: string,
  idToOrder: Record<string, number>,
): Promise<Record<number, PrinciplePlan>> {
  const [pp, acts] = await Promise.all([
    supabase.from('plan_principle_plans').select('principle_id, victory_vision').eq('plan_id', planId),
    supabase.from('plan_activities').select('*').eq('plan_id', planId).order('position'),
  ]);

  const out: Record<number, PrinciplePlan> = {};
  const ensure = (order: number) => {
    if (!out[order]) out[order] = { activities: [], victoryVision: '' };
    return out[order];
  };

  for (const row of pp.data ?? []) {
    const order = idToOrder[row.principle_id];
    if (order === undefined) continue;
    ensure(order).victoryVision = row.victory_vision;
  }

  for (const a of acts.data ?? []) {
    const order = idToOrder[a.principle_id];
    if (order === undefined) continue;
    ensure(order).activities.push({
      id: a.id,
      title: a.title,
      desc: a.description,
      metrics: a.metrics,
      audiences: a.audiences ?? [],
      audienceNote: a.audience_note ?? '',
      owner: a.owner,
      priority: a.priority,
      type: a.category,
      source: a.source ?? undefined,
      bankKey: a.bank_key ?? undefined,
      isExpanded: false, // UI-only; never persisted
    });
  }

  return out;
}

export async function savePrinciplePlans(
  planId: string,
  plans: Record<number, PrinciplePlan>,
  orderToId: Record<number, string>,
): Promise<void> {
  const planRows: Record<string, unknown>[] = [];
  const activityRows: Record<string, unknown>[] = [];
  const keepIds: string[] = [];

  for (const [orderStr, p] of Object.entries(plans)) {
    const principleId = orderToId[Number(orderStr)];
    if (!principleId) continue;

    planRows.push({
      plan_id: planId,
      principle_id: principleId,
      victory_vision: p.victoryVision ?? '',
    });

    (p.activities ?? []).forEach((a, i) => {
      keepIds.push(a.id);
      activityRows.push({
        id: a.id,
        plan_id: planId,
        principle_id: principleId,
        title: a.title ?? '',
        description: a.desc ?? '',
        metrics: a.metrics ?? '',
        audiences: a.audiences ?? [],
        audience_note: a.audienceNote ?? '',
        owner: a.owner ?? '',
        priority: a.priority ?? 'medium',
        category: a.type ?? '',
        source: a.source ?? null,
        bank_key: a.bankKey ?? null,
        position: i,
      });
    });
  }

  if (planRows.length) {
    await supabase
      .from('plan_principle_plans')
      .upsert(planRows as never, { onConflict: 'plan_id,principle_id' });
  }
  if (activityRows.length) {
    await supabase.from('plan_activities').upsert(activityRows as never);
  }

  // Drop activities the user removed (must run after the upsert).
  let del = supabase.from('plan_activities').delete().eq('plan_id', planId);
  if (keepIds.length) del = del.not('id', 'in', `(${keepIds.join(',')})`);
  await del;
}

// ---- export builder config (per version) -----------------------------------

export interface ExportConfig {
  sections: Record<string, boolean>;
  principalMessage: string;
  visionText: string;
}

export async function loadExportConfig(planId: string): Promise<ExportConfig | null> {
  const { data } = await supabase
    .from('plan_export_configs')
    .select('sections, principal_message, vision_text')
    .eq('plan_id', planId)
    .maybeSingle();

  if (!data) return null;
  return {
    sections: (data.sections ?? {}) as Record<string, boolean>,
    principalMessage: data.principal_message,
    visionText: data.vision_text,
  };
}

export async function saveExportConfig(planId: string, cfg: ExportConfig): Promise<void> {
  await supabase.from('plan_export_configs').upsert(
    {
      plan_id: planId,
      sections: cfg.sections as never,
      principal_message: cfg.principalMessage ?? '',
      vision_text: cfg.visionText ?? '',
    },
    { onConflict: 'plan_id' },
  );
}

// ---- school profile ("כרטיס ביקור") — school-level, shared across versions ---

export interface LoadedProfile {
  principalName: string;
  principalSeniority: string;
  studentCount: string;
  vision: string;
  goals: string;
  uniqueness: string;
}

export async function loadSchoolProfile(schoolId: string): Promise<(LoadedProfile & { logoPath: string | null }) | null> {
  const { data } = await supabase
    .from('schools')
    .select('principal_name, principal_seniority, student_count, vision, goals, uniqueness, logo_path')
    .eq('id', schoolId)
    .single();

  if (!data) return null;
  return {
    logoPath: data.logo_path,
    principalName: data.principal_name,
    principalSeniority: data.principal_seniority,
    // The UI keeps this free-text; the column is numeric.
    studentCount: data.student_count == null ? '' : String(data.student_count),
    vision: data.vision,
    goals: data.goals,
    uniqueness: data.uniqueness,
  };
}

export async function saveSchoolProfile(schoolId: string, p: LoadedProfile): Promise<void> {
  const digits = (p.studentCount ?? '').replace(/[^\d]/g, '');
  await supabase
    .from('schools')
    .update({
      principal_name: p.principalName ?? '',
      principal_seniority: p.principalSeniority ?? '',
      student_count: digits ? Number(digits) : null,
      vision: p.vision ?? '',
      goals: p.goals ?? '',
      uniqueness: p.uniqueness ?? '',
    })
    .eq('id', schoolId);
}

// ---- Storage: school logo + attachments ------------------------------------

const BUCKET = 'school-assets';

/** Short-lived signed URL — the bucket is private, so <img src> needs one. */
export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? '';
}

export async function uploadLogo(schoolId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${schoolId}/logo/logo.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) return null;
  await supabase.from('schools').update({ logo_path: path }).eq('id', schoolId);
  return path;
}

export async function removeLogo(schoolId: string, path: string | null): Promise<void> {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from('schools').update({ logo_path: null }).eq('id', schoolId);
}

export async function loadSchoolFiles(schoolId: string): Promise<SchoolFileMeta[]> {
  const { data } = await supabase
    .from('school_files')
    .select('id, name, size_bytes, mime_type, storage_path')
    .eq('school_id', schoolId)
    .order('created_at');

  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size_bytes,
    type: f.mime_type,
    path: f.storage_path,
  }));
}

export async function uploadSchoolFiles(schoolId: string, files: File[]): Promise<SchoolFileMeta[]> {
  const added: SchoolFileMeta[] = [];
  for (const file of files) {
    const path = `${schoolId}/files/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    if (error) continue;

    const { data } = await supabase
      .from('school_files')
      .insert({
        school_id: schoolId,
        name: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: path,
      })
      .select('id')
      .single();

    added.push({ id: data?.id, name: file.name, size: file.size, type: file.type, path });
  }
  return added;
}

export async function deleteSchoolFile(meta: SchoolFileMeta): Promise<void> {
  if (meta.path) await supabase.storage.from(BUCKET).remove([meta.path]);
  if (meta.id) await supabase.from('school_files').delete().eq('id', meta.id);
}

/**
 * Clear the version's mapping (and optionally its focus anchors). Needed because
 * emptying React state alone would leave the DB rows in place — they would come
 * straight back on the next load.
 */
export async function clearAssessments(planId: string, alsoFocus = false): Promise<void> {
  await supabase.from('plan_assessments').delete().eq('plan_id', planId);
  if (alsoFocus) await supabase.from('plan_focus').delete().eq('plan_id', planId);
}

// NOTE: an automatic "import leftover localStorage data into the current plan"
// step used to live here. It was removed after it leaked one school's mapping
// into the next school that logged in on the same tab: the data it copied came
// from React state that survives logout, and pre-auth localStorage data has no
// unambiguous owner anyway. Any such migration must be an explicit, per-school
// action — never an implicit side effect of logging in.
