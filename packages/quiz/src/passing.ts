/**
 * Passing-threshold helpers.
 *
 * `passingScore` on Quiz is a PERCENTAGE (0..100), never an absolute point
 * count — the teacher-facing field is labelled «Порог сдачи (%)» and capped at
 * 100. Comparing a raw score against it (score >= passingScore) makes any quiz
 * whose maximum is below the threshold impossible to pass, so always go through
 * these helpers instead of comparing by hand.
 */

/** Score as a rounded percentage of the maximum; 0 when maxScore is 0. */
export function scorePercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 100);
}

/**
 * Whether an attempt passes the quiz threshold.
 * Returns null when the quiz has no threshold configured.
 */
export function isPassed(
  score: number,
  maxScore: number,
  passingScore: number | null,
): boolean | null {
  if (passingScore == null) return null;
  return scorePercent(score, maxScore) >= passingScore;
}
