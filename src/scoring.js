// Pure scoring rules: points per pop, combo multipliers and star thresholds.

// Index is the combo level: 0 = no combo, 4 = max (x3)
export const COMBO_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];
// A pop within this window of the previous one extends the combo
export const COMBO_WINDOW_MS = 2500;

export function calculatePoints(count) {
  if (count <= 3) return 100;
  if (count === 4) return 300;
  if (count === 5) return 800;
  if (count === 6) return 1500;
  return 3000;
}

/** Next combo level given the time since the previous pop (null = first pop). */
export function nextComboLevel(comboLevel, msSinceLastPop) {
  if (msSinceLastPop !== null && msSinceLastPop < COMBO_WINDOW_MS) {
    return Math.min(comboLevel + 1, COMBO_MULTIPLIERS.length - 1);
  }
  return 0;
}

// Stars: 1 at the target, 2 at +10%, 3 at +25%
export function getStarCount(score, target) {
  if (score >= target * 1.25) return 3;
  if (score >= target * 1.10) return 2;
  if (score >= target) return 1;
  return 0;
}

/** Progress (0..1) towards the next star. */
export function getStarProgress(score, target) {
  if (score >= target * 1.25) return 1;
  if (score >= target * 1.10) return (score - target * 1.10) / (target * 0.15);
  if (score >= target) return (score - target) / (target * 0.10);
  return Math.min(score / target, 1);
}
