import type { BankItem } from './activityBank';

/**
 * Look-alike detection for activity titles. Pure functions, no DB — kept separate from
 * `activityBankAdmin` so it can be exercised on its own.
 *
 * Hebrew titles vary in ways that shouldn't count as different activities: quote marks
 * (״ ' " ), maqaf vs hyphen, punctuation, and common connecting words. Strip all of
 * that before comparing.
 */
const STOP_WORDS = new Set(['של', 'עם', 'על', 'את', 'ואת', 'או', 'אל', 'לכל', 'בכל', 'עבור', 'a', 'the']);

export function normalizeTitle(s: string): string {
  return (s ?? '')
    .replace(/[״"'׳`]/g, '')
    .replace(/[־–—-]/g, ' ')
    .replace(/[()[\]{},.;:!?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(' ');
}

const trigrams = (s: string): Set<string> => {
  const padded = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
};

/** Dice coefficient over character trigrams — 1 is identical, 0 shares nothing. */
export function similarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  const ta = trigrams(x);
  const tb = trigrams(y);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

export interface DuplicateHit {
  item: BankItem;
  score: number;
  exact: boolean;
}

/**
 * Find activities that look like `title`. Purely advisory: the caller shows a warning
 * and saves anyway — two schools may legitimately run similarly-named activities.
 */
export function findSimilar(title: string, existing: BankItem[], threshold = 0.55): DuplicateHit[] {
  const target = normalizeTitle(title);
  if (!target) return [];

  return existing
    .map((item) => ({ item, score: similarity(title, item.title), exact: normalizeTitle(item.title) === target }))
    .filter((h) => h.exact || h.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
