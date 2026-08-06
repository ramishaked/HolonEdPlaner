import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { usePrinciples } from './PrinciplesContext';
import type { TaskSource } from '../types';

/**
 * The activity bank (בנק פעילויות) comes from the DB only — `activity_bank_items`,
 * RLS-scoped to the signed-in school (its municipality's curated items + any the
 * school owns). There is no hardcoded copy: it is dynamic content that a city admin
 * is meant to curate, so a second copy in the source would immediately drift.
 *
 * An activity may serve several principles at once (join table
 * `activity_bank_item_principles`), so the same item can appear under more than one
 * tab in the planning zone.
 */
export interface BankItem {
  key: string;
  title: string;
  type: string; // internal category — drives the victory-vision heuristics (not displayed)
  source: TaskSource; // task origin — the displayed chip
  short: string; // "מטרת העל" — the card's one-liner
  metrics: string; // "מדדי הצלחה ויעדים" — prefills the activity when added to a plan
  audiences: string[]; // slugs from the DB `audiences` picklist
  audienceNote: string;
  contact: string;
  description: string;
  /** UI principle ids (order_index) this activity is linked to. */
  principles: number[];
  /** Who owns the row. A municipal admin may read school items but not write them. */
  scope: 'municipal' | 'school';
  /** false → hidden from the schools. Only the admin console ever sees these. */
  isActive: boolean;
  /** Rank inside its principle group — what the admin reorders. */
  position: number;
  /** Stable key the spreadsheet importer matches on. Opaque, never derived from content. */
  slug: string;
}

const SELECT =
  'id, slug, title, category, source, short, description, metrics, audiences, audience_note, contact, scope, school_id, position, is_active, activity_bank_item_principles(principle_id)';

export interface LoadedBank {
  /** Grouped by the UI's numeric principle id (= `principles.order_index`). */
  byPrinciple: Record<number, BankItem[]>;
  /** Every item once, for admin listing and duplicate checks. */
  all: BankItem[];
}

/**
 * `includeInactive` is for the admin console, which lists hidden activities so they
 * can be brought back — and so the city keeps seeing which schools adopted one before
 * it was hidden. `byPrinciple` stays active-only regardless: it feeds every picker.
 */
export async function fetchActivityBank(
  idToOrder: Record<string, number>,
  opts: { includeInactive?: boolean } = {},
): Promise<LoadedBank> {
  let query = supabase.from('activity_bank_items').select(SELECT);
  if (!opts.includeInactive) query = query.eq('is_active', true);

  // Second key so a tie in `position` stops reshuffling between loads.
  const { data, error } = await query.order('position').order('title');

  if (error || !data) return { byPrinciple: {}, all: [] };

  const byPrinciple: Record<number, BankItem[]> = {};
  const all: BankItem[] = [];

  for (const row of data) {
    const orders = (row.activity_bank_item_principles ?? [])
      .map((l) => idToOrder[l.principle_id])
      .filter((o): o is number => o !== undefined);

    const item: BankItem = {
      key: row.id,
      slug: row.slug,
      isActive: row.is_active,
      position: row.position,
      title: row.title,
      type: row.category,
      source: row.source,
      short: row.short,
      metrics: row.metrics,
      audiences: row.audiences ?? [],
      audienceNote: row.audience_note ?? '',
      contact: row.contact,
      description: row.description,
      principles: orders,
      scope: row.scope,
    };

    all.push(item);
    // The same item is listed under every principle it serves — but a hidden one is
    // listed nowhere: `byPrinciple` is what the planning zone offers.
    if (item.isActive) for (const order of orders) (byPrinciple[order] ??= []).push(item);
  }

  return { byPrinciple, all };
}

/** Loads the bank once the principle set (and therefore the uuid↔order map) is known. */
export function useActivityBank(opts: { includeInactive?: boolean } = {}) {
  const { orderToId } = usePrinciples();
  const [bank, setBank] = useState<Record<number, BankItem[]>>({});
  const [all, setAll] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);

  const includeInactive = !!opts.includeInactive;

  const load = useCallback(async () => {
    if (!Object.keys(orderToId).length) return null;

    const idToOrder: Record<string, number> = {};
    for (const [order, uuid] of Object.entries(orderToId)) idToOrder[uuid] = Number(order);

    setLoading(true);
    return fetchActivityBank(idToOrder, { includeInactive });
  }, [orderToId, includeInactive]);

  const reload = useCallback(async () => {
    const data = await load();
    if (!data) return;
    setBank(data.byPrinciple);
    setAll(data.all);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    let active = true;
    load().then((data) => {
      if (!active || !data) return;
      setBank(data.byPrinciple);
      setAll(data.all);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [load]);

  return { bank, all, loading, reload };
}
