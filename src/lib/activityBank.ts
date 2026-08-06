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
}

const SELECT =
  'id, title, category, source, short, description, metrics, audiences, audience_note, contact, scope, school_id, position, activity_bank_item_principles(principle_id)';

export interface LoadedBank {
  /** Grouped by the UI's numeric principle id (= `principles.order_index`). */
  byPrinciple: Record<number, BankItem[]>;
  /** Every item once, for admin listing and duplicate checks. */
  all: BankItem[];
}

export async function fetchActivityBank(
  idToOrder: Record<string, number>,
): Promise<LoadedBank> {
  const { data, error } = await supabase
    .from('activity_bank_items')
    .select(SELECT)
    .eq('is_active', true)
    .order('position');

  if (error || !data) return { byPrinciple: {}, all: [] };

  const byPrinciple: Record<number, BankItem[]> = {};
  const all: BankItem[] = [];

  for (const row of data) {
    const orders = (row.activity_bank_item_principles ?? [])
      .map((l) => idToOrder[l.principle_id])
      .filter((o): o is number => o !== undefined);

    const item: BankItem = {
      key: row.id,
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
    // The same item is listed under every principle it serves.
    for (const order of orders) (byPrinciple[order] ??= []).push(item);
  }

  return { byPrinciple, all };
}

/** Loads the bank once the principle set (and therefore the uuid↔order map) is known. */
export function useActivityBank() {
  const { orderToId } = usePrinciples();
  const [bank, setBank] = useState<Record<number, BankItem[]>>({});
  const [all, setAll] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!Object.keys(orderToId).length) return;

    const idToOrder: Record<string, number> = {};
    for (const [order, uuid] of Object.entries(orderToId)) idToOrder[uuid] = Number(order);

    setLoading(true);
    const data = await fetchActivityBank(idToOrder);
    setBank(data.byPrinciple);
    setAll(data.all);
    setLoading(false);
  }, [orderToId]);

  useEffect(() => {
    let active = true;
    if (!Object.keys(orderToId).length) return;

    const idToOrder: Record<string, number> = {};
    for (const [order, uuid] of Object.entries(orderToId)) idToOrder[uuid] = Number(order);

    setLoading(true);
    fetchActivityBank(idToOrder).then((data) => {
      if (!active) return;
      setBank(data.byPrinciple);
      setAll(data.all);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [orderToId]);

  return { bank, all, loading, reload };
}
