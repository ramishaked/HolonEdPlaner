import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { principleScore } from './scoring';
import type { DiagnosticResponse } from '../types';

/**
 * City-wide statistics for the municipal dashboard.
 *
 * Everything here is already permitted by RLS: `app.can_read_plan` grants a city_admin
 * read access to every plan in its municipality, and `schools_select` to every school.
 * No new policy, and no server-side view — the whole municipality is a few hundred rows,
 * so the aggregation happens here where the scoring rules already live.
 *
 * Deliberately reads status and scores only. Free text a school wrote (evidence, vision,
 * the principal's message) is none of the dashboard's business.
 */

export type SchoolStage = 'not_started' | 'mapping' | 'mapped' | 'planning';

export interface SchoolRow {
  id: string;
  name: string;
  stage: SchoolStage;
  /** How many principles this school actually mapped. */
  mapped: number;
  activities: number;
  /** Average over the principles it mapped — null when it mapped none. */
  averageScore: number | null;
  updatedAt: string | null;
}

export interface PrincipleStat {
  principleId: number;
  /** Mean over schools that mapped this principle. */
  average: number | null;
  /** How many schools that mean is based on — always shown next to it. */
  schools: number;
  min: number | null;
  max: number | null;
  strengthPicks: number;
  breakthroughPicks: number;
}

export interface ActivityUptake {
  bankKey: string;
  schools: number;
}

export interface MunicipalStats {
  schools: SchoolRow[];
  stageCounts: Record<SchoolStage, number>;
  byPrinciple: PrincipleStat[];
  uptake: ActivityUptake[];
  /** Activities schools wrote themselves ("יוזמה ייחודית") — no bank item behind them. */
  customActivities: number;
  totalActivities: number;
}

export const STAGE_LABEL: Record<SchoolStage, string> = {
  not_started: 'טרם התחילו',
  mapping: 'באמצע המיפוי',
  mapped: 'המיפוי הושלם',
  planning: 'בנו תוכנית',
};

export async function fetchMunicipalStats(
  idToOrder: Record<string, number>,
  principleIds: number[],
): Promise<MunicipalStats> {
  const [schoolsRes, plansRes, assessRes, focusRes, actsRes] = await Promise.all([
    supabase.from('schools').select('id, name').order('name'),
    supabase.from('plans').select('id, school_id, updated_at'),
    supabase
      .from('plan_assessments')
      .select('plan_id, principle_id, why_score, how_score, what_score, selected_maturity_level'),
    supabase.from('plan_focus').select('plan_id, principle_id, role'),
    supabase.from('plan_activities').select('plan_id, bank_key'),
  ]);

  const schools = schoolsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const planToSchool = new Map(plans.map((p) => [p.id, p.school_id]));

  // ---- per school ----------------------------------------------------------
  const perSchool = new Map<
    string,
    { mapped: number; scoreSum: number; activities: number; updatedAt: string | null }
  >();
  for (const s of schools) perSchool.set(s.id, { mapped: 0, scoreSum: 0, activities: 0, updatedAt: null });
  for (const p of plans) {
    const entry = perSchool.get(p.school_id);
    if (entry && p.updated_at && (!entry.updatedAt || p.updated_at > entry.updatedAt)) {
      entry.updatedAt = p.updated_at;
    }
  }

  // ---- per principle -------------------------------------------------------
  const scoresByPrinciple = new Map<number, number[]>();
  for (const id of principleIds) scoresByPrinciple.set(id, []);

  for (const a of assessRes.data ?? []) {
    const order = idToOrder[a.principle_id];
    const schoolId = planToSchool.get(a.plan_id);
    if (order === undefined || !schoolId) continue;

    const score = principleScore({
      whyScore: a.why_score,
      howScore: a.how_score,
      whatScore: a.what_score,
      selectedMaturityLevel: a.selected_maturity_level,
    } as DiagnosticResponse);

    scoresByPrinciple.get(order)?.push(score);
    const entry = perSchool.get(schoolId);
    if (entry) { entry.mapped++; entry.scoreSum += score; }
  }

  const strength = new Map<number, number>();
  const breakthrough = new Map<number, number>();
  for (const f of focusRes.data ?? []) {
    const order = idToOrder[f.principle_id];
    if (order === undefined) continue;
    const target = f.role === 'strength' ? strength : breakthrough;
    target.set(order, (target.get(order) ?? 0) + 1);
  }

  // ---- activities ----------------------------------------------------------
  const uptakeSchools = new Map<string, Set<string>>();
  let customActivities = 0;
  let totalActivities = 0;

  for (const act of actsRes.data ?? []) {
    const schoolId = planToSchool.get(act.plan_id);
    if (!schoolId) continue;
    totalActivities++;
    const entry = perSchool.get(schoolId);
    if (entry) entry.activities++;

    if (act.bank_key) {
      if (!uptakeSchools.has(act.bank_key)) uptakeSchools.set(act.bank_key, new Set());
      uptakeSchools.get(act.bank_key)!.add(schoolId);
    } else {
      customActivities++;
    }
  }

  // ---- assemble ------------------------------------------------------------
  const total = principleIds.length;
  const rows: SchoolRow[] = schools.map((s) => {
    const e = perSchool.get(s.id)!;
    const stage: SchoolStage =
      e.activities > 0 ? 'planning'
      : e.mapped >= total && total > 0 ? 'mapped'
      : e.mapped > 0 ? 'mapping'
      : 'not_started';
    return {
      id: s.id,
      name: s.name,
      stage,
      mapped: e.mapped,
      activities: e.activities,
      averageScore: e.mapped ? e.scoreSum / e.mapped : null,
      updatedAt: e.updatedAt,
    };
  });

  const stageCounts: Record<SchoolStage, number> = {
    not_started: 0, mapping: 0, mapped: 0, planning: 0,
  };
  for (const r of rows) stageCounts[r.stage]++;

  const byPrinciple: PrincipleStat[] = principleIds.map((id) => {
    const list = scoresByPrinciple.get(id) ?? [];
    return {
      principleId: id,
      average: list.length ? list.reduce((a, b) => a + b, 0) / list.length : null,
      schools: list.length,
      min: list.length ? Math.min(...list) : null,
      max: list.length ? Math.max(...list) : null,
      strengthPicks: strength.get(id) ?? 0,
      breakthroughPicks: breakthrough.get(id) ?? 0,
    };
  });

  const uptake: ActivityUptake[] = [...uptakeSchools.entries()]
    .map(([bankKey, set]) => ({ bankKey, schools: set.size }))
    .sort((a, b) => b.schools - a.schools);

  return { schools: rows, stageCounts, byPrinciple, uptake, customActivities, totalActivities };
}

export function useMunicipalStats(idToOrder: Record<string, number>, principleIds: number[]) {
  const [stats, setStats] = useState<MunicipalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const key = `${Object.keys(idToOrder).length}:${principleIds.join(',')}`;

  useEffect(() => {
    let active = true;
    if (!Object.keys(idToOrder).length || !principleIds.length) return;

    setLoading(true);
    fetchMunicipalStats(idToOrder, principleIds).then((s) => {
      if (!active) return;
      setStats(s);
      setLoading(false);
    });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { stats, loading };
}
