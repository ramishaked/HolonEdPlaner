import { supabase } from './supabase';
import type { Principle, PrincipleMaturity } from '../types';

/**
 * Loads the dynamic principle set from the DB for the signed-in school:
 * the municipality's active "fixed" principles + this school's own custom ones
 * (RLS scopes both). Mapped back into the app's existing `Principle` shape, keyed
 * by `order_index` so the numeric-id UI keeps working; the DB uuid is kept aside
 * for future write-backs.
 */
export interface LoadedPrinciples {
  principles: Principle[];
  rubrics: PrincipleMaturity[];
  shortTitles: Record<number, string>;
  /** order_index → DB uuid, for persisting assessments/plans later. */
  orderToId: Record<number, string>;
}

/**
 * `includeInactive` is for the municipal admin console, which must list retired
 * principles in order to bring them back. The school journey never passes it.
 */
export async function fetchPrinciples(
  opts: { includeInactive?: boolean } = {},
): Promise<LoadedPrinciples | null> {
  let query = supabase
    .from('principles')
    .select('*, principle_sources(*), principle_rubric_levels(*)');
  if (!opts.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query.order('order_index');

  if (error || !data) return null;

  const principles: Principle[] = [];
  const rubrics: PrincipleMaturity[] = [];
  const shortTitles: Record<number, string> = {};
  const orderToId: Record<number, string> = {};

  for (const row of data) {
    // NOTE: municipal and school-scoped principles share this map, keyed by order_index.
    // Nothing creates school-scoped principles today; when that arrives, namespace their
    // order_index (1000+) so it cannot collide with the municipal 1..N.
    const orderId = row.order_index;
    orderToId[orderId] = row.id;
    shortTitles[orderId] = row.title;

    const sources = [...(row.principle_sources ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((s) => ({ title: s.title, description: s.description, url: s.url, keywords: s.keywords }));

    principles.push({
      id: orderId,
      uuid: row.id,
      isActive: row.is_active,
      scope: row.scope,
      title: row.title,
      icon: row.icon,
      colorName: row.color_name,
      accentColor: row.accent_color,
      bgLight: row.bg_light,
      textDark: row.text_dark,
      shortSummary: row.short_summary,
      rationale: row.rationale,
      gapsSolved: row.gaps_solved,
      addedValue: row.added_value,
      implementationStrategy: row.implementation_strategy,
      sacrificesRequired: row.sacrifices_required,
      ecosystemPartnerships: row.ecosystem_partnerships,
      kpis: row.kpis,
      teacherDeliverable: row.teacher_deliverable,
      studentDeliverable: row.student_deliverable,
      firstStep: row.first_step,
      sources,
      shortLabel: row.short_label,
    });

    rubrics.push({
      id: orderId,
      levels: [...(row.principle_rubric_levels ?? [])]
        .sort((a, b) => a.level - b.level)
        .map((l) => ({ level: l.level, name: l.name, description: l.description })),
    });
  }

  return { principles, rubrics, shortTitles, orderToId };
}
