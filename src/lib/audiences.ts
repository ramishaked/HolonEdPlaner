import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * The "קהל יעד" picklist. It is municipality data, not a code constant: a city admin
 * curates it, so both the activity bank and the planned activities pick from the same
 * DB-backed vocabulary. Selecting is multi-value; `is_other` marks the catch-all option
 * that reveals the free-text note.
 */
export interface Audience {
  slug: string;
  label: string;
  isOther: boolean;
}

export async function fetchAudiences(): Promise<Audience[]> {
  const { data, error } = await supabase
    .from('audiences')
    .select('slug, label, is_other')
    .eq('is_active', true)
    .order('position');

  if (error || !data) return [];
  return data.map((r) => ({ slug: r.slug, label: r.label, isOther: r.is_other }));
}

export function useAudiences() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAudiences().then((rows) => {
      if (!active) return;
      setAudiences(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { audiences, loading };
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
