/**
 * shop.js — Shop UI rendering & logic
 *
 * Handles opening, rendering, tab switching, and purchase logic
 * for boosters, skins, and the coin ad tab.
 */

import {
  SHOP_BOOSTERS,
  getCoins, getBoosterCount, buyBooster,
} from './economy.js';
import { t } from './translations.js';
import { playErrorSound, playPurchaseSound } from './audio.js';
// tutorialState (not tutorial.js) to avoid the shop ↔ tutorial import cycle
import { isTutorialActive } from './tutorialState.js';
import { renderCalendar, getCalendarState } from './dailyCalendar.js';
import { openDailySpinModal, canSpinToday } from './dailySpin.js';

// ======================== COIN AD DAILY LIMIT ========================

const COIN_AD_DAILY_LIMIT = 5;

/** Current day's watched-count for the free-coins rewarded ad. */
export function getCoinAdState() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem('bolitas_coinAdDate');
  const count = lastDate === today ? (parseInt(localStorage.getItem('bolitas_coinAdCount')) || 0) : 0;
  return { today, count, limit: COIN_AD_DAILY_LIMIT };
}

/** Called from the onRewarded handler (main.js) once the reward is actually earned. */
export function registerCoinAdWatched() {
  const { today, count } = getCoinAdState();
  localStorage.setItem('bolitas_coinAdDate', today);
  localStorage.setItem('bolitas_coinAdCount', String(count + 1));
}

// ======================== STATE ========================

let _updateHeaderCoins = null;
let _showRewardedAd = null;

/**
 * Initialise the shop module with external callbacks.
 * Must be called once during app boot.
 */
export function initShop({ updateHeaderCoins, showRewardedAd }) {
  _updateHeaderCoins = updateHeaderCoins;
  _showRewardedAd = showRewardedAd;

  // Wire up tab switching
  document.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderShopItems(tab.dataset.tab);
    });
  });

  updateShopNotifications();
}

/**
 * Checks for pending rewards (like calendar) and applies visual glow to tabs.
 */
export function updateShopNotifications() {
  const { canClaimToday } = getCalendarState();
  
  // 1. Internal shop tab (Calendar)
  const calendarTab = document.querySelector('.shop-tab[data-tab="calendar"]');
  if (calendarTab) {
    calendarTab.classList.toggle('glow-slow', canClaimToday);
  }

  // 2. Global footer tab
  const shopFooterTab = document.getElementById('footer-tab-shop');
  if (shopFooterTab) {
    shopFooterTab.classList.toggle('glow-slow', canClaimToday);
  }

  // 3. Header shop button (if visible)
  const shopHeaderBtn = document.getElementById('header-shop-btn');
  if (shopHeaderBtn) {
    shopHeaderBtn.classList.toggle('glow-slow', canClaimToday);
  }
}

// ======================== OPEN / CLOSE ========================

export function openShop() {
  document.getElementById('quests-screen')?.classList.add('hidden');
  document.getElementById('biome-map-screen')?.classList.add('hidden');
  document.getElementById('shop-coin-count').innerText = getCoins();
  renderShopItems('boosters');
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.shop-tab[data-tab="boosters"]').classList.add('active');
  document.getElementById('shop-screen').classList.remove('hidden');
  document.getElementById('powerups-bar')?.classList.add('hidden'); // Hide during shop

  // Sync footer
  document.querySelectorAll('.app-footer-tab').forEach(tab => {
    tab.classList.toggle('active', tab.id === 'footer-tab-shop');
  });

  if (canSpinToday()) {
    setTimeout(() => openDailySpinModal(), 800);
  }
}

export function closeShop() {
  document.getElementById('shop-screen').classList.add('hidden');
  
  // Only reveal powerups bar if we're actually in a level (not the map)
  const isMapVisible = !document.getElementById('biome-map-screen')?.classList.contains('hidden');
  if (!isMapVisible) {
    document.getElementById('powerups-bar')?.classList.remove('hidden');
  }
}

// ======================== RENDER ========================

export function renderShopItems(tab) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';

  if (tab === 'calendar') {
    renderCalendar(container, _updateHeaderCoins);
  } else if (tab === 'boosters') {
    renderBoosters(container);
  } else if (tab === 'coins') {
    renderCoinAd(container);
  }
}

// ---------- Boosters ----------

function renderBoosters(container) {
  SHOP_BOOSTERS.forEach(booster => {
    const count = getBoosterCount(booster.id);
    const canAfford = getCoins() >= booster.price;

    const item = document.createElement('div');
    item.className = 'shop-item';
    item.dataset.boosterId = booster.id;

    // Level Lock Logic — data-driven via booster.unlockLevel
    const maxUnlocked = parseInt(localStorage.getItem('bolitasLevel')) || 0;
    const currentLevel = maxUnlocked + 1;
    const isLocked = booster.unlockLevel ? currentLevel < booster.unlockLevel : false;

    if (isLocked) {
      item.classList.add('locked-item');
      item.style.opacity = '0.6';
      item.style.filter = 'grayscale(0.8)';
    }

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'shop-item-icon';
    iconDiv.textContent = isLocked ? '🔒' : booster.icon;

    // Info — name and count are separate elements so count updates independently
    const infoDiv = document.createElement('div');
    infoDiv.className = 'shop-item-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'shop-item-name';
    const nameText = document.createElement('span');
    nameText.textContent = t(`booster_${booster.id}_name`);
    nameDiv.appendChild(nameText);
    if (count > 0) {
      const countBadge = document.createElement('span');
      countBadge.className = 'shop-booster-count';
      countBadge.textContent = ` (×${count})`;
      nameDiv.appendChild(countBadge);
    }

    const descDiv = document.createElement('div');
    descDiv.className = 'shop-item-desc';
    if (isLocked) {
      descDiv.textContent = t('unlock_at_level', { val: booster.unlockLevel });
      descDiv.style.color = 'var(--clr-orange)';
      descDiv.style.fontWeight = 'bold';
    } else {
      descDiv.textContent = t(`booster_${booster.id}_desc`);
    }

    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(descDiv);

    // Price button
    const btn = document.createElement('button');
    btn.className = 'shop-item-price';
    if (isLocked) {
      btn.textContent = '🔒';
      btn.classList.add('disabled');
    } else {
      btn.innerHTML = `🪙 ${booster.price}`;
      if (!canAfford) btn.classList.add('disabled');
    }

    btn.addEventListener('click', () => {
      if (isLocked) {
        playErrorSound();
        return;
      }
      item.classList.add('pushed');
      setTimeout(() => item.classList.remove('pushed'), 150);

      if (getCoins() < booster.price) {
        playErrorSound();
        return;
      }
      if (window._mandatoryBoosterPurchase && window._mandatoryBoosterPurchase !== booster.id) {
        playErrorSound();
        return;
      }
      if (buyBooster(booster.id)) {
        playPurchaseSound();
        refreshCoinDisplays();
        if (!isTutorialActive()) {
          renderShopItems('boosters');
        }
        if (window._mandatoryBoosterPurchase === booster.id) {
          window._mandatoryBoosterPurchase = null;
        }
      }
    });

    item.appendChild(iconDiv);
    item.appendChild(infoDiv);
    item.appendChild(btn);
    container.appendChild(item);
  });
}

// ---------- Coins (Ad) ----------

function renderCoinAd(container) {
  const item = document.createElement('div');
  item.className = 'shop-item';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'shop-item-icon';
  iconDiv.textContent = '📺';

  const infoDiv = document.createElement('div');
  infoDiv.className = 'shop-item-info';
  const nameDiv = document.createElement('div');
  nameDiv.className = 'shop-item-name';
  nameDiv.textContent = t('free_coins');
  const descDiv = document.createElement('div');
  descDiv.className = 'shop-item-desc';
  descDiv.textContent = t('free_coins_desc');
  infoDiv.appendChild(nameDiv);
  infoDiv.appendChild(descDiv);

  const btn = document.createElement('button');
  btn.className = 'shop-item-price ad-reward';
  btn.textContent = `🎥 ${t('get_reward_coins', { val: 100 })}`;
  btn.addEventListener('click', () => {
    // Daily limit — the counter increments in main.js's onRewarded handler,
    // only when the reward was actually earned
    const { count, limit } = getCoinAdState();
    if (count >= limit) {
      const originalText = btn.textContent;
      btn.textContent = t('limit_reached', { cur: limit, max: limit });
      playErrorSound();
      setTimeout(() => btn.textContent = originalText, 2000);
      return;
    }

    if (_showRewardedAd) {
      _showRewardedAd('shop_coins');
    }
  });

  item.appendChild(iconDiv);
  item.appendChild(infoDiv);
  item.appendChild(btn);
  container.appendChild(item);
}

// ======================== HELPERS ========================

function refreshCoinDisplays() {
  const coins = getCoins();
  const shopCoinEl = document.getElementById('shop-coin-count');
  if (shopCoinEl) shopCoinEl.innerText = coins;

  if (_updateHeaderCoins) _updateHeaderCoins();
}
