/**
 * dailyCalendar.js — Daily Login Reward Calendar
 *
 * Tracks how many consecutive days the player has logged in
 * and renders a 7-day reward grid inside the calendar shop tab.
 *
 * State is persisted in localStorage under `gloop_calendar`.
 */

import { addCoins, addBoosterFree } from './economy.js';
import { t } from './translations.js';
import analyticsManager from './analyticsManager.js';
import { playDailyClaimSound } from './audio.js';

// ======================== CONFIG ========================

/** The 7 daily rewards. Index 0 = Day 1, index 6 = Day 7. */
const DAILY_REWARDS = [
  { type: 'coins',   amount: 100,  icon: '🪙',  label: () => `100` },
  { type: 'coins',   amount: 200,  icon: '🪙',  label: () => `200` },
  { type: 'booster', id: 'shuffle', icon: '🔀', label: () => t('booster_shuffle_name') },
  { type: 'coins',   amount: 300,  icon: '🪙',  label: () => `300` },
  { type: 'booster', id: 'bomb',   icon: '💣',  label: () => t('booster_bomb_name') },
  { type: 'coins',   amount: 500,  icon: '🪙',  label: () => `500` },
  { type: 'coins',   amount: 1000, icon: '🪙',  label: () => `1000 🎁`, special: true },
];

const STORAGE_KEY = 'gloop_calendar';

// ======================== STATE ========================

function getDefaultState() {
  return {
    streak: 0,         // current consecutive day streak (0 = nothing claimed yet)
    lastClaimDate: '', // ISO date string (YYYY-MM-DD)
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...getDefaultState(), ...JSON.parse(raw) } : getDefaultState();
  } catch {
    return getDefaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** YYYY-MM-DD using the LOCAL calendar day (toISOString would flip at UTC midnight) */
function localDayString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns today's date as YYYY-MM-DD (local time) */
function todayString() {
  return localDayString(new Date());
}

/** Returns yesterday's date as YYYY-MM-DD (local time) */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDayString(d);
}

// ======================== API ========================

/**
 * Returns the current calendar state enriched with derived flags.
 * @returns {{ streak, lastClaimDate, canClaimToday, currentDayIndex }}
 */
export function getCalendarState() {
  const state = loadState();
  const today = todayString();
  const yesterday = yesterdayString();

  // Streak is reset if the player didn't claim yesterday (and today is a new day)
  const streakBroken =
    state.lastClaimDate !== today &&
    state.lastClaimDate !== yesterday &&
    state.lastClaimDate !== '';

  const effectiveStreak = streakBroken ? 0 : state.streak;

  // canClaimToday: haven't claimed today yet
  const canClaimToday = state.lastClaimDate !== today;

  // currentDayIndex: which slot (0-6) is the active one.
  // If already claimed today, we show the one just claimed (Day N).
  // If not claimed, we show the next one to claim (Day N+1).
  const currentDayIndex = canClaimToday 
    ? (effectiveStreak % 7) 
    : ((effectiveStreak - 1 + 7) % 7);

  return {
    streak: effectiveStreak,
    lastClaimDate: state.lastClaimDate,
    canClaimToday,
    currentDayIndex,
    streakBroken,
  };
}

/**
 * Claim today's reward. Returns { success, reward } where reward is the DAILY_REWARDS entry.
 */
export function claimTodayReward() {
  const { canClaimToday, currentDayIndex, streak } = getCalendarState();
  if (!canClaimToday) return { success: false };

  const reward = DAILY_REWARDS[currentDayIndex];

  // Apply the reward
  if (reward.type === 'coins') {
    addCoins(reward.amount);
  } else if (reward.type === 'booster') {
    addBoosterFree(reward.id, 1);
  }

  // Log daily feature used event for daily login
  analyticsManager.logCustomEvent(analyticsManager.Events.DAILY_FEATURE_USED, {
    [analyticsManager.Params.FEATURE_NAME]: 'daily_login'
  });

  // Persist updated state
  const state = loadState();
  // IMPORTANT: use 'streak' from getCalendarState (which handles streakBroken reset to 0)
  state.streak = streak + 1; 
  state.lastClaimDate = todayString();
  saveState(state);

  return { success: true, reward };
}

// ======================== RENDER ========================

/**
 * Renders the 7-day calendar grid into `container`.
 * @param {HTMLElement} container
 * @param {function} onCoinsUpdate - callback to refresh the coin display
 */
export function renderCalendar(container, onCoinsUpdate) {
  container.innerHTML = '';

  const { canClaimToday, currentDayIndex } = getCalendarState();

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'text-align:center; font-size:1.4rem; font-weight:900; color:#fff; margin-bottom:0.8rem;';
  header.textContent = t('calendar_title');
  container.appendChild(header);

  // Grid  of 7 day cards
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(70px,1fr)); gap:0.6rem; margin-bottom:1rem; padding:0.5rem; overflow:visible;';

  DAILY_REWARDS.forEach((reward, i) => {
    const card = document.createElement('div');
    const isPast      = i < currentDayIndex;
    const isCurrent   = i === currentDayIndex;
    const isFuture    = i > currentDayIndex;

    card.style.cssText = `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      border-radius:14px; padding:0.6rem 0.3rem; gap:0.3rem; font-size:0.8rem; font-weight:700;
      border: 1.5px solid ${isCurrent ? 'rgba(255,215,0,0.6)' : (isPast ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)')};
      background: ${isPast ? 'rgba(16,185,129,0.1)' : (isCurrent ? 'rgba(255,215,0,0.12)' : 'rgba(0,0,0,0.2)')};
      box-shadow: ${isCurrent ? '0 0 16px rgba(255,215,0,0.25)' : 'none'};
      transition: all 0.2s;
      cursor: ${isCurrent && canClaimToday ? 'pointer' : 'default'};
      ${isCurrent && canClaimToday ? 'animation: winQuestPulse 1.5s infinite alternate ease-in-out;' : ''}
      overflow: visible;
    `;

    if (isCurrent && canClaimToday) {
      card.addEventListener('click', () => {
        card.style.pointerEvents = 'none';
        card.style.animation = 'none';
        card.style.transform = 'scale(0.95)';
        
        const result = claimTodayReward();
        if (result.success) {
          playDailyClaimSound();
          if (onCoinsUpdate) onCoinsUpdate();
          renderCalendar(container, onCoinsUpdate);
        }
      });
    }

    const dayLabel = document.createElement('div');
    dayLabel.style.cssText = 'font-size:0.65rem; font-weight:600; color:rgba(255,255,255,0.45); text-transform:uppercase; letter-spacing:0.5px;';
    dayLabel.textContent = t('calendar_day', { val: i + 1 });

    const icon = document.createElement('div');
    icon.style.cssText = `font-size:${reward.special ? '1.8rem' : '1.4rem'};`;
    icon.textContent = reward.icon;

    const amount = document.createElement('div');
    amount.style.cssText = `font-size:0.8rem; color:${isPast ? 'var(--clr-green)' : (isCurrent ? '#ffd700' : 'rgba(255,255,255,0.5)')};`;
    amount.textContent = reward.label();

    // State badge
    const badge = document.createElement('div');
    badge.style.cssText = 'font-size:0.65rem; font-weight:700;';
    if (isPast)    { badge.textContent = t('calendar_claimed'); badge.style.color = 'var(--clr-green)'; }
    if (isCurrent) { badge.textContent = canClaimToday ? '▾' : t('calendar_claimed'); badge.style.color = '#ffd700'; }
    if (isFuture)  { badge.textContent = t('calendar_locked'); badge.style.color = 'rgba(255,255,255,0.25)'; }

    card.appendChild(dayLabel);
    card.appendChild(icon);
    card.appendChild(amount);
    card.appendChild(badge);
    grid.appendChild(card);
  });

  container.appendChild(grid);

  if (!canClaimToday) {
    const doneLabel = document.createElement('p');
    doneLabel.style.cssText = 'text-align:center; color:var(--clr-green); font-weight:700; font-size:0.9rem; margin-top:0.5rem;';
    doneLabel.textContent = t('calendar_streak_reset');
    container.appendChild(doneLabel);
  } else {
    const hint = document.createElement('p');
    hint.style.cssText = 'text-align:center; color:#ffd700; font-weight:700; font-size:0.9rem; margin-top:0.5rem;';
    hint.textContent = t('calendar_claim_btn');
    container.appendChild(hint);
  }
}
