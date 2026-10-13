/**
 * dailySpin.js — Daily Fortune Wheel
 *
 * 10-segment wheel with CSS-driven animation.
 * First spin per day is free. Second spin requires a Rewarded Ad.
 * Re-Spin prizes are double the base amounts; "nothing" → 500 coins.
 *
 * State persisted under `gloop_spin`.
 */

import { addCoins, addBoosterFree } from './economy.js';
import { t } from './translations.js';
import analyticsManager from './analyticsManager.js';

const SVG_STRINGS = {
  coin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FBBF24" stroke="#FFF" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 12h8" stroke="#FFF"/></svg>`,
  shuffle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`,
  bomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#374151" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"></circle><path d="M14.5 9.5L16 8"></path><path d="M18 5h-1a1 1 0 0 0-1 1v1"></path><path d="M19 4l1-1"></path></svg>`,
  colorbomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path><path d="M9 15c-1.5 2.5-4 5.5-7 5.5 2.5-3 3-6.5 2.5-10"></path></svg>`,
  trio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10B981" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>`,
};

const ICONS = {};
Object.keys(SVG_STRINGS).forEach((key) => {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG_STRINGS[key]);
  ICONS[key] = img;
});

const getSvgHtml = (type) =>
  `<img src="${ICONS[type].src}" style="width:1.2em;height:1.2em;vertical-align:middle;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.5));" />`;

// ======================== PRIZE CONFIG ========================

/**
 * 10-segment prize table.
 * label()     — translated text shown on the wheel segment
 * labelFull() — longer result text shown after spinning
 * apply()     — function that grants the prize
 * applyDouble() — function that grants the double version on respin
 */
export const SPIN_PRIZES = [
  // 1. 500 Coins
  {
    id: 'coins_500a',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#EC4899', // Pink
    label: (isGolden) => (isGolden ? 'x1000' : 'x500'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 1000 : 500 }),
    apply: () => addCoins(500),
    applyDouble: () => addCoins(1000),
  },
  // 2. 100 Coins
  {
    id: 'coins_100a',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#3B82F6', // Blue
    label: (isGolden) => (isGolden ? 'x200' : 'x100'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 200 : 100 }),
    apply: () => addCoins(100),
    applyDouble: () => addCoins(200),
  },
  // 3. Shuffle Booster
  {
    id: 'booster_shuffle',
    imgKey: 'shuffle',
    get icon() {
      return getSvgHtml('shuffle');
    },
    bg: '#8B5CF6', // Purple
    label: (isGolden) =>
      isGolden ? t('daily_spin_label_booster_double') : t('daily_spin_label_booster'),
    labelFull: (isGolden) =>
      isGolden ? '2x ' + t('booster_shuffle_name') : t('booster_shuffle_name'),
    apply: () => addBoosterFree('shuffle', 1),
    applyDouble: () => addBoosterFree('shuffle', 2),
  },
  // 4. 500 Coins
  {
    id: 'coins_500b',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#EC4899', // Pink
    label: (isGolden) => (isGolden ? 'x1000' : 'x500'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 1000 : 500 }),
    apply: () => addCoins(500),
    applyDouble: () => addCoins(1000),
  },
  // 5. 1000 Coins
  {
    id: 'coins_1000',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#10B981', // Emerald Green (Jackpot coins)
    label: (isGolden) => (isGolden ? 'x2000' : 'x1000'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 2000 : 1000 }),
    apply: () => addCoins(1000),
    applyDouble: () => addCoins(2000),
  },
  // 6. Bomb Booster
  {
    id: 'booster_bomb',
    imgKey: 'bomb',
    get icon() {
      return getSvgHtml('bomb');
    },
    bg: '#EF4444', // Red
    label: (isGolden) =>
      isGolden ? t('daily_spin_label_booster_double') : t('daily_spin_label_booster'),
    labelFull: (isGolden) => (isGolden ? '2x ' + t('booster_bomb_name') : t('booster_bomb_name')),
    apply: () => addBoosterFree('bomb', 1),
    applyDouble: () => addBoosterFree('bomb', 2),
  },
  // 7. 100 Coins
  {
    id: 'coins_100b',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#3B82F6', // Blue
    label: (isGolden) => (isGolden ? 'x200' : 'x100'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 200 : 100 }),
    apply: () => addCoins(100),
    applyDouble: () => addCoins(200),
  },
  // 8. Color Bomb Booster
  {
    id: 'booster_colorbomb',
    imgKey: 'colorbomb',
    get icon() {
      return getSvgHtml('colorbomb');
    },
    bg: '#F59E0B', // Amber
    label: (isGolden) =>
      isGolden ? t('daily_spin_label_booster_double') : t('daily_spin_label_booster'),
    labelFull: (isGolden) =>
      isGolden ? '2x ' + t('booster_color_bomb_name') : t('booster_color_bomb_name'),
    apply: () => addBoosterFree('color_bomb', 1),
    applyDouble: () => addBoosterFree('color_bomb', 2),
  },
  // 9. 500 Coins
  {
    id: 'coins_500c',
    imgKey: 'coin',
    get icon() {
      return getSvgHtml('coin');
    },
    bg: '#EC4899', // Pink
    label: (isGolden) => (isGolden ? 'x1000' : 'x500'),
    labelFull: (isGolden) => t('daily_spin_prize_coins', { val: isGolden ? 1000 : 500 }),
    apply: () => addCoins(500),
    applyDouble: () => addCoins(1000),
  },
  // 10. Trio Booster (Grand Jackpot)
  {
    id: 'booster_trio',
    imgKey: 'trio',
    get icon() {
      return getSvgHtml('trio');
    },
    bg: '#0F766E', // Teal/Dark Green
    label: (isGolden) =>
      isGolden ? t('daily_spin_label_prize_double') : t('daily_spin_label_prize'),
    labelFull: (isGolden) =>
      isGolden ? '2x ' + t('daily_spin_prize_booster_trio') : t('daily_spin_prize_booster_trio'),
    apply: () => {
      addBoosterFree('shuffle', 1);
      addBoosterFree('bomb', 1);
      addBoosterFree('color_bomb', 1);
    },
    applyDouble: () => {
      addBoosterFree('shuffle', 2);
      addBoosterFree('bomb', 2);
      addBoosterFree('color_bomb', 2);
    },
  },
];

const TOTAL = SPIN_PRIZES.length; // 10
const SEGMENT_ANGLE = 360 / TOTAL; // 36°

// ======================== STATE ========================

const STORAGE_KEY = 'gloop_spin';

// Local calendar day (NOT UTC): the free spin must reset at the player's midnight
function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lastSpinDate: '', hasRespun: false };
  } catch {
    return { lastSpinDate: '', hasRespun: false };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Returns true if the user hasn't spun today yet. */
export function canSpinToday() {
  return loadState().lastSpinDate !== todayString();
}

/** Returns true if the user has done the first spin today but hasn't respun. */
export function canRespinToday() {
  const s = loadState();
  return s.lastSpinDate === todayString() && !s.hasRespun;
}

/** Called after the first (free) spin completes. */
function markFirstSpin() {
  const s = loadState();
  s.lastSpinDate = todayString();
  s.hasRespun = false;
  saveState(s);
}

/** Called after the rewarded respin completes. */
function markRespin() {
  const s = loadState();
  s.hasRespun = true;
  saveState(s);
}

// ======================== MODAL ========================

const MODAL_ID = 'daily-spin-modal';
let _onCoinsUpdate = null;
let _showRewardedAd = null;

export function initDailySpin({ onCoinsUpdate, showRewardedAd }) {
  _onCoinsUpdate = onCoinsUpdate;
  _showRewardedAd = showRewardedAd;

  // Wire the global rewarded-ad callback for re-spin
  window._dailySpinOnRespinAdRewarded = () => {
    markRespin();

    const wheel = document.getElementById('spin-wheel');
    const resultArea = document.getElementById('spin-result-area');
    const spinBtn = document.getElementById('spin-btn');
    const respinBtn = document.getElementById('respin-btn');

    if (!wheel || !resultArea) return;
    respinBtn.style.display = 'none';
    resultArea.innerHTML = '';

    // Swap old wheel for the Golden wheel
    const wheelWrap = wheel.parentNode;
    const newWheel = buildWheel(true);
    newWheel.id = 'spin-wheel';
    newWheel.style.cssText = wheel.style.cssText;
    newWheel.style.transition = 'none';
    newWheel.style.transform = 'rotate(0deg)';
    wheelWrap.replaceChild(newWheel, wheel);

    // Show a golden "Spin!" button — user must tap to start
    const freshBtn = spinBtn.cloneNode(true);
    freshBtn.id = 'spin-btn';
    freshBtn.disabled = false;
    freshBtn.style.opacity = '1';
    freshBtn.style.display = 'block';
    freshBtn.style.background = 'linear-gradient(135deg, #F59E0B, #D97706)';
    freshBtn.textContent = t('daily_spin_spin_btn');
    spinBtn.parentNode.replaceChild(freshBtn, spinBtn);
    freshBtn.addEventListener('click', () => {
      startSpin(newWheel, resultArea, freshBtn, respinBtn, true);
    });
  };
}

/** Open the modal. If canSpinToday === false, still shows but in "already spun" state. */
export function openDailySpinModal() {
  // Tear down any previous instance
  closeDailySpinModal();

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:20000;
    background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
    display:flex; align-items:center; justify-content:center;
    padding-bottom: 80px; /* Shift upwards to clear ad banner */
    animation:fadeInOverlay 0.25s ease;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background:linear-gradient(160deg,#0a0a18,#13162a);
    border:1px solid rgba(255,255,255,0.12); border-radius:24px;
    padding:1.2rem; width:92%; max-width:360px;
    max-height: 85vh; overflow-y: auto;
    box-shadow:0 24px 80px rgba(0,0,0,0.6);
    animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards;
    text-align:center;
  `;

  // Title
  const title = document.createElement('h2');
  title.style.cssText = 'font-size:1.6rem; font-weight:900; color:#fff; margin:0 0 0.2rem;';
  title.textContent = t('daily_spin_title');

  const subtitle = document.createElement('p');
  subtitle.style.cssText = 'font-size:0.85rem; color:rgba(255,255,255,0.5); margin:0 0 1rem;';
  subtitle.textContent = t('daily_spin_subtitle');

  // Wheel
  const wheelWrap = document.createElement('div');
  const wheelSize = window.innerHeight < 700 ? 190 : 230;
  wheelWrap.style.cssText = `position:relative; width:${wheelSize}px; height:${wheelSize}px; margin:0 auto 1rem;`;

  const wheel = buildWheel();
  wheel.id = 'spin-wheel';
  wheel.style.cssText =
    'width:100%; height:100%; border-radius:50%; transition:transform 4s cubic-bezier(0.17,0.67,0.12,1); transform-origin:center center; will-change:transform;';

  // Pointer
  const pointer = document.createElement('div');
  pointer.style.cssText = `
    position:absolute; top:-12px; left:50%; transform:translateX(-50%);
    width:0; height:0;
    border-left:12px solid transparent; border-right:12px solid transparent;
    border-top:22px solid #fff; filter:drop-shadow(0 0 6px rgba(255,255,255,0.6));
    z-index:5;
  `;

  wheelWrap.appendChild(wheel);
  wheelWrap.appendChild(pointer);

  // Result area
  const resultArea = document.createElement('div');
  resultArea.id = 'spin-result-area';
  resultArea.style.cssText = 'min-height:2.5rem; margin-bottom:0.8rem;';

  // Spin button
  const spinBtn = document.createElement('button');
  spinBtn.id = 'spin-btn';
  spinBtn.className = 'glass-btn primary';
  spinBtn.style.cssText = 'width:100%; font-size:1.1rem; font-weight:900; margin-bottom:0.5rem;';

  // Respin button (hidden initially)
  const respinBtn = document.createElement('button');
  respinBtn.id = 'respin-btn';
  respinBtn.className = 'glass-btn';
  respinBtn.style.cssText =
    'width:100%; font-size:0.85rem; font-weight:700; background:linear-gradient(135deg,#7c3aed,#4f46e5); display:none;';
  respinBtn.textContent = t('daily_spin_respin_btn');

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'glass-btn';
  closeBtn.style.cssText =
    'width:100%; margin-top:0.5rem; font-weight:700; opacity:1; pointer-events:auto;';
  closeBtn.textContent = t('close');
  closeBtn.addEventListener('click', closeDailySpinModal);

  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(wheelWrap);
  panel.appendChild(resultArea);
  panel.appendChild(spinBtn);
  panel.appendChild(respinBtn);
  panel.appendChild(closeBtn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Set initial spin button state
  if (canSpinToday()) {
    spinBtn.textContent = t('daily_spin_spin_btn');
    spinBtn.addEventListener('click', () =>
      startSpin(wheel, resultArea, spinBtn, respinBtn, false),
    );
  } else if (canRespinToday()) {
    spinBtn.style.display = 'none';
    respinBtn.style.display = 'block';
    resultArea.innerHTML = `<p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">${t('daily_spin_already_spun')}</p>`;
    // (click handled by the single listener registered below)
  } else {
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.4';
    spinBtn.textContent = t('daily_spin_already_spun');
  }

  respinBtn.addEventListener('click', () => triggerRespinAd());
}

export function closeDailySpinModal() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();
}

// ======================== WHEEL BUILDER ========================

function buildWheel(isGolden = false) {
  const isSmall = window.innerHeight < 700;
  const size = isSmall ? 190 : 230;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 2;

  // Alternate Golden shades when in Respin mode
  const goldenPalettes = ['#F59E0B', '#D97706', '#B45309', '#FCD34D'];

  SPIN_PRIZES.forEach((prize, i) => {
    const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180);
    const endAngle = startAngle + SEGMENT_ANGLE * (Math.PI / 180);

    // Slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();

    ctx.fillStyle = isGolden ? goldenPalettes[i % goldenPalettes.length] : prize.bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label: Draw along the radius (vertically relative to the segment)
    const midAngle = startAngle + (SEGMENT_ANGLE / 2) * (Math.PI / 180);
    // Pull the anchor point slightly inward to avoid the rim
    const textR = r * 0.72;
    const tx = cx + textR * Math.cos(midAngle);
    const ty = cy + textR * Math.sin(midAngle);

    ctx.save();
    ctx.translate(tx, ty);
    // Rotate so text points towards the center (baseline along the radius)
    ctx.rotate(midAngle);
    ctx.fillStyle = '#fff';
    ctx.font = '900 11px sans-serif'; // Small enough to fit inside each wedge
    // Align right so the text ends at the anchor point
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(prize.label(isGolden), 0, 0);

    // Draw the SVG icon next to the text
    const img = ICONS[prize.imgKey];
    if (img && img.complete) {
      ctx.shadowColor = 'transparent';
      // Place icon just after the text
      ctx.drawImage(img, 5, -8, 16, 16);
    }

    ctx.restore();
  });

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a18';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

// ======================== SPIN LOGIC ========================

let _isSpinning = false;

function startSpin(wheel, resultArea, spinBtn, respinBtn, isRespin) {
  if (_isSpinning) return;
  _isSpinning = true;

  spinBtn.disabled = true;
  resultArea.innerHTML = '';

  // Log daily feature used event for roulette
  analyticsManager.logCustomEvent(analyticsManager.Events.DAILY_FEATURE_USED, {
    [analyticsManager.Params.FEATURE_NAME]: 'roulette',
  });

  // Pick random winner
  const winnerIndex = Math.floor(Math.random() * TOTAL);

  // Calculate angle: land the pointer (top, -90°) on the center of the winner segment
  const winnerMidAngle = winnerIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2; // degrees from top
  const extraSpins = 5 + Math.floor(Math.random() * 3); // 5–7 full rotations
  const finalAngle = extraSpins * 360 + (360 - winnerMidAngle);

  wheel.style.transition = 'transform 4s cubic-bezier(0.17,0.67,0.12,1)';
  wheel.style.transform = `rotate(${finalAngle}deg)`;

  setTimeout(() => {
    _isSpinning = false;
    const prize = SPIN_PRIZES[winnerIndex];

    if (!isRespin) {
      // Apply base prize for a free spin
      prize.apply();
      if (_onCoinsUpdate) _onCoinsUpdate();
      markFirstSpin();
    } else {
      // Apply double prize for a golden respin
      prize.applyDouble();
      if (_onCoinsUpdate) _onCoinsUpdate();
    }

    showSpinResult(prize, isRespin);

    // Show respin button if first spin and hasn't respun
    if (!isRespin && canRespinToday()) {
      respinBtn.style.display = 'block';
    }
  }, 4200);
}

function showSpinResult(prize, isDouble) {
  const resultArea = document.getElementById('spin-result-area');
  if (!resultArea) return;

  const msg = t('daily_spin_prize_won', { prize: `${prize.icon} ${prize.labelFull(isDouble)}` });
  resultArea.innerHTML = `
    <p style="font-size:1.1rem; font-weight:900; color:#ffd700; animation:popIn 0.3s ease;">${msg}</p>
  `;
}

function triggerRespinAd() {
  if (!_showRewardedAd) return;
  // State changes are now handled globally inside _showRewardedAd in main.js
  _showRewardedAd('daily_spin_respin');
}
