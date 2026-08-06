import type { DiagnosticAnswers, DiagnosticResponse } from '../types';

/**
 * The institutional maturity score, in one place.
 *
 * A principle's score weights the chosen rubric level (70%) against the average of the
 * three "golden circle" axes — why / how / what (30%). The school journey and the
 * municipal dashboard must agree to the decimal, so neither inlines the arithmetic.
 */
export function principleScore(a: DiagnosticResponse): number {
  const maturityLevel = a.selectedMaturityLevel ?? 1;
  const goldenCircleAvg = (a.whyScore + a.howScore + a.whatScore) / 3;
  return maturityLevel * 0.7 + goldenCircleAvg * 0.3;
}

/** Baseline shown for a principle a school has not mapped yet. */
export const UNMAPPED_SCORE = 1.0;

/**
 * Scores for a whole set of principles, as the radar and the journey expect them:
 * an unmapped principle falls back to the baseline so every axis has a value.
 *
 * NOTE: that fallback is a *display* convenience. Never average these across schools —
 * unmapped principles would masquerade as genuine 1.0 weakness. For aggregates use
 * `mappedScores`, which reports only what was actually answered.
 */
export function scoresFor(answers: DiagnosticAnswers, ids: number[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const id of ids) {
    const ans = answers[id];
    out[id] = ans ? principleScore(ans) : UNMAPPED_SCORE;
  }
  return out;
}

/**
 * The system's suggested focus, derived from the maturity map: the strongest principle
 * becomes the anchor to leverage, the two weakest become the breakthrough targets.
 *
 * Takes the ANSWERS, not the display scores, on purpose. Display scores fill 1.0 for
 * principles nobody assessed, which would make untouched principles look like the
 * school's greatest weaknesses and hand them the breakthrough slots. Only a principle
 * that was actually mapped can be recommended.
 *
 * It is only a starting point — the principal overrides it in the export zone, and this
 * is what the "restore the recommendation" action returns to.
 */
export function recommendedFocus(answers: DiagnosticAnswers): {
  strength?: number;
  breakthroughs: number[];
} {
  const ranked = Object.entries(mappedScores(answers))
    .map(([id, score]) => ({ id: Number(id), score }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return { breakthroughs: [] };

  const strength = ranked[0].id;
  // The anchor can never double as a breakthrough target — they mean opposite things.
  const breakthroughs = ranked
    .filter((p) => p.id !== strength)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((p) => p.id);

  return { strength, breakthroughs };
}

/** Only the principles this school actually mapped — the honest basis for an average. */
export function mappedScores(answers: DiagnosticAnswers): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [id, ans] of Object.entries(answers)) {
    if (ans) out[Number(id)] = principleScore(ans);
  }
  return out;
}
