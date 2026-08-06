import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * The "קהל יעד" picklist. It is municipality data, not a code constant: a city admin
 * curates it, so both the activity bank and the planned activities pick from the same
 * DB-backed vocabulary. Selecting is multi-value; `is_other` marks the catch-all option
 * that reveals the free-text note.
 */
export interface Audience {
  id: string;
  slug: string;
  label: string;
  isOther: boolean;
  isActive: boolean;
  position: number;
}

/**
 * Reads the whole picklist, retired entries included. Deactivating an audience must
 * remove it from the pickers without erasing it from activities that already carry it —
 * the slugs live in `text[]` columns with no FK, so an unresolvable slug would simply
 * vanish from a saved plan and from the exported document. Callers pick their list:
 * `audiences` (active) to choose from, `all` to render a label.
 */
export async function fetchAudiences(): Promise<Audience[]> {
  const { data, error } = await supabase
    .from('audiences')
    .select('id, slug, label, is_other, is_active, position')
    .order('position');

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    isOther: r.is_other,
    isActive: r.is_active,
    position: r.position,
  }));
}

export function useAudiences() {
  const [all, setAll] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAudiences().then((rows) => {
      if (!active) return;
      setAll(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  // `audiences` — what may be chosen. `all` — what may be displayed.
  return { audiences: all.filter((a) => a.isActive), all, loading, reload };
}

/**
 * Render a set of audience slugs as Hebrew text, in the picklist's own order, with the
 * free-text note appended. Used on the bank card, in the plan and in the export doc.
 */
export function audienceLabel(
  slugs: string[] | undefined,
  note: string | undefined,
  audiences: Audience[],
): string {
  const picked = audiences.filter((a) => (slugs ?? []).includes(a.slug));
  const names = picked.filter((a) => !a.isOther).map((a) => a.label);
  const hasOther = picked.some((a) => a.isOther);
  const trimmed = (note ?? '').trim();

  // "אחר" carries no meaning on its own — its note replaces it.
  if (hasOther && trimmed) names.push(trimmed);
  else if (hasOther) names.push('אחר');

  const text = names.join(' · ');
  // A note alongside concrete audiences qualifies them ("תלמידי השכבה (שכבת ח')").
  if (!hasOther && trimmed) return text ? `${text} (${trimmed})` : trimmed;
  return text;
}
