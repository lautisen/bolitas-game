/**
 * streak.js — Consecutive-day play streak with coin milestones.
 *
 * A day counts once per local calendar day. Missing a day restarts the
 * streak at 1. Rewards are paid by the caller.
 */

const STREAK_KEY = 'gloop_active_streak';
export const STREAK_REWARDS = [
  { day: 3, coins: 100 },
  { day: 7, coins: 300 },
  { day: 14, coins: 500 },
  { day: 30, coins: 1000 },
];

export function getStreakData() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY)) || { count: 0, lastDate: null };
  } catch (_) {
    return { count: 0, lastDate: null };
  }
}

// Local calendar day (NOT UTC): the "day" must flip at the player's midnight
function localDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Records that the player was active today.
 * @returns {{ days: number, coins: number } | null} the milestone reward reached today, if any
 */
export function recordActiveDay(now = new Date()) {
  const data = getStreakData();
  const today = localDateString(now);
  if (data.lastDate === today) return null; // already updated today

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  data.count = data.lastDate === localDateString(yesterday) ? data.count + 1 : 1;
  data.lastDate = today;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));

  const reward = STREAK_REWARDS.find((r) => r.day === data.count);
  return reward ? { days: data.count, coins: reward.coins } : null;
}

export function renderActiveStreakBadge() {
  const data = getStreakData();
  const badge = document.getElementById('active-streak-display');
  const countEl = document.getElementById('active-streak-count');
  if (!badge || !countEl) return;
  if (data.count >= 2) {
    countEl.textContent = data.count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
