import './style.css';
import { saveScore, getLeaderboard } from './firebase.js';
import { playSelectSound, playPopSound, playErrorSound, playGameOverSound } from './audio.js';
import { checkAppVersion } from './versionCheck.js';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';


const bgmAudio = new Audio('./assets/bgm.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0.4;

const COLS = 10;
const ROWS = 12;
const MIN_GROUP = 3;
// Colors ordered by visual distinctiveness — levels using fewer colors get the first N entries
const COLORS = ['red', 'blue', 'green', 'cyan', 'yellow', 'pink'];
const ZEN_COLORS = ['red', 'green', 'purple', 'yellow', 'cyan']; // Fixed Zen palette

// Generate 100 levels with gradual difficulty curve
function generateLevels() {
  const levels = [];
  for (let i = 0; i < 100; i++) {
    const level = i + 1;
    // Rows/Cols: start at 5x5, grow gradually to 12x12
    const size = Math.min(12, 5 + Math.floor(i / 8));
    // Colors: start at 3, increase slowly
    let colors;
    if (level <= 5) colors = 3;
    else if (level <= 15) colors = 4;
    else if (level <= 35) colors = 5;
    else colors = 6;
    // Target score: gradual curve
    // Target score: gradual curve, rounded to the nearest 100
    const target = Math.round((100 + (i * 80) + (Math.pow(i, 1.3) * 10)) / 100) * 100;
    levels.push({ target, rows: size, cols: size, colors });
  }
  return levels;
}
const LEVELS = generateLevels();

let currentMode = 'adventure'; // 'adventure', 'zen', 'timeattack'
let currentLevelIndex = 0;
let timeRemaining = 0;
let timerInterval = null;
let currentRows = 10;
let currentCols = 10;
let currentColors = 5;
let currentColorSet = COLORS; // which palette to use

let grid = [];
let score = 0;
let uiScore; // This will link to the subtext area as well
let uiHeaderMode;
let uiHeaderScoreDetails;
let uiGrid;
let isAnimating = false;
let selectedGroup = [];
let currentUser = null;
let comboMultiplier = 1;
let lastPopTime = 0;
let comboTimeout = null;

let isAudioEnabled = localStorage.getItem('bolitasAudioEnabled') !== 'false';
let isColorblindEnabled = localStorage.getItem('bolitasColorblindEnabled') === 'true';
let hintTimeout = null;
const HINT_DELAY = 5000; // 5 seconds
let hasUsedRevive = false;
let isBannerCreated = false;
let isAdLoading = false;
let levelCompleted = false;

// Performance: O(1) element-to-position lookup instead of O(rows*cols) scan
const elementPositionMap = new WeakMap();
// Performance: track hinted elements to avoid querySelectorAll
let hintedElements = [];

document.addEventListener('DOMContentLoaded', async () => {
  uiHeaderMode = document.getElementById('header-mode-display');
  uiHeaderScoreDetails = document.getElementById('header-score-details');
  uiGrid = document.getElementById('grid');

  // Check for updates - Wait for it to complete
  const isUpdateRequired = await checkAppVersion();

  // Log app open
  FirebaseAnalytics.logEvent({ name: 'app_open', params: {} });

  if (isUpdateRequired) {
    console.log('App update required. Stopping initialization.');
    return;
  }

  // Ask for notification permission early, before the user starts playing
  requestNotificationPermission();

  // UI Handlers

  document.getElementById('pass-level-btn').addEventListener('click', () => {
    document.getElementById('pass-level-btn').classList.add('hidden');
    handleLevelComplete();
  });
  document.getElementById('play-again-btn').addEventListener('click', () => {
    const btn = document.getElementById('play-again-btn');
    if (btn.dataset.action === 'retry' || btn.dataset.action === 'next') {
      initGame();
    } else {
      returnToMainMenu();
    }
  });
  document.getElementById('reward-continue-btn').addEventListener('click', () => {
    document.getElementById('reward-ready-screen').classList.add('hidden');
    initGame(true);
  });
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', logoutUser);
  document.getElementById('back-to-menu-btn').addEventListener('click', returnToMainMenu);
  document.getElementById('show-leaderboard-btn').addEventListener('click', showLeaderboard);
  document.getElementById('close-leaderboard-btn').addEventListener('click', hideLeaderboard);
  document.getElementById('celebration-continue-btn').addEventListener('click', () => {
    document.getElementById('clear-celebration').classList.add('hidden');
    document.getElementById('confetti-container').innerHTML = '';
    if (currentMode === 'adventure') {
      handleLevelComplete();
    } else {
      showGameOver(false);
    }
  });
  document.getElementById('exit-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.add('hidden');
    returnToMainMenu();
  });

  // Settings Handlers (header button)
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.remove('hidden');
  });
  document.getElementById('close-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.add('hidden');
  });

  // Overlay settings/leaderboard buttons (multiple across screens)
  document.querySelectorAll('.overlay-settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('settings-screen').classList.remove('hidden');
    });
  });
  document.querySelectorAll('.overlay-leaderboard-btn').forEach(btn => {
    btn.addEventListener('click', showLeaderboard);
  });

  // Initialize settings UI
  document.getElementById('audio-toggle').checked = isAudioEnabled;
  document.getElementById('colorblind-toggle').checked = isColorblindEnabled;
  if (isColorblindEnabled) document.body.classList.add('color-blind-mode');

  document.getElementById('audio-toggle').addEventListener('change', (e) => {
    isAudioEnabled = e.target.checked;
    localStorage.setItem('bolitasAudioEnabled', isAudioEnabled);
    if (isAudioEnabled) {
      if (currentMode && !document.getElementById('login-screen').classList.contains('hidden') === false) {
        bgmAudio.play().catch(e => console.log('Autoplay prevented'));
      }
    } else {
      bgmAudio.pause();
    }
  });
  document.getElementById('colorblind-toggle').addEventListener('change', (e) => {
    isColorblindEnabled = e.target.checked;
    localStorage.setItem('bolitasColorblindEnabled', isColorblindEnabled);
    if (isColorblindEnabled) {
      document.body.classList.add('color-blind-mode');
    } else {
      document.body.classList.remove('color-blind-mode');
    }
  });

  // Unlocked overlay btn
  document.getElementById('unlocked-continue-btn').addEventListener('click', () => {
    document.getElementById('mode-unlocked-screen').classList.add('hidden');
  });

  // Game Mode Selection
  document.getElementById('mode-levels-btn').addEventListener('click', () => {
    currentMode = 'adventure';
    startGame();
  });
  document.getElementById('mode-zen-btn').addEventListener('click', () => {
    if (localStorage.getItem('bolitasLevel') < 50) return;
    localStorage.setItem('hasPlayedZen', 'true');
    currentMode = 'zen';
    startGame();
  });
  document.getElementById('mode-timeattack-btn').addEventListener('click', () => {
    if (localStorage.getItem('bolitasLevel') < 30) return;
    localStorage.setItem('hasPlayedTimeAttack', 'true');
    currentMode = 'timeattack';
    startGame();
  });

  document.getElementById('revive-btn').addEventListener('click', showRewardedAd);

  checkExistingSession();
  initAdMob();
});

async function initAdMob() {
  try {
    await AdMob.initialize({});
    console.log('AdMob initialized');
    FirebaseAnalytics.logEvent({ name: 'admob_initialized', params: {} });

    // Rewarded ad listeners (v8 event names from source)
    const onRewarded = (rewardItem) => {
      console.log('User was rewarded', rewardItem);
      applyReviveReward();
    };
    const hideLoading = () => {
      console.log('Hiding ad loading screen');
      document.getElementById('ad-loading-screen').classList.add('hidden');
      if (adLoadingTimeout) {
        clearTimeout(adLoadingTimeout);
        adLoadingTimeout = null;
      }
      showBannerAd();
    };

    // Try both naming conventions for robustness across versions
    const events = [
      'interstitialAdDismissed', 'onInterstitialAdDismissed',
      'interstitialAdFailedToLoad', 'onInterstitialAdFailedToLoad',
      'interstitialAdFailedToShow', 'onInterstitialAdFailedToShow',
      'rewardVideoAdDismissed', 'onRewardedVideoAdDismissed',
      'rewardVideoAdFailedToLoad', 'onRewardedVideoAdFailedToLoad',
      'rewardVideoAdFailedToShow', 'onRewardedVideoAdFailedToShow'
    ];

    events.forEach(eventName => {
      AdMob.addListener(eventName, (err) => {
        if (err) console.error(`Ad event ${eventName} with error: `, err);
        else console.log(`Ad event: ${eventName} `);
        hideLoading();
      });
    });

    // Keep the reward listener as is since it doesn't hide the loading screen (dismissal does)
    AdMob.addListener('onRewardedVideoAdReward', onRewarded);
    AdMob.addListener('rewardVideoAdReward', onRewarded);

    // Show banner globally as soon as initialized
    showBannerAd();

  } catch (err) {
    console.error('AdMob initialization failed', err);
  }
}

async function prepareInterstitial() {
  try {
    const options = {
      adId: 'ca-app-pub-3539090903954344/2163380169',
      isTesting: false
    };
    await AdMob.prepareInterstitial(options);
  } catch (err) {
    console.error('Prepare Interstitial Error', err);
  }
}

async function prepareRewarded() {
  try {
    const options = {
      adId: 'ca-app-pub-3539090903954344/5831162433',
      isTesting: false
    };
    await AdMob.prepareRewardVideoAd(options);
  } catch (err) {
    console.error('Prepare Rewarded Error', err);
  }
}

let adLoadingTimeout = null;

async function showInterstitialAd() {
  try {
    document.getElementById('ad-loading-screen').classList.remove('hidden');

    // Safety timeout: auto-hide after 5 seconds if ad fails or gets stuck
    if (adLoadingTimeout) clearTimeout(adLoadingTimeout);
    adLoadingTimeout = setTimeout(() => {
      console.warn('Ad safety timeout reached, hiding loading screen');
      document.getElementById('ad-loading-screen').classList.add('hidden');
      adLoadingTimeout = null;
    }, 5000);

    // 2-second delay to ensure the user sees the disclaimer/multilingual messages
    await new Promise(resolve => setTimeout(resolve, 2000));
    await AdMob.showInterstitial();
    FirebaseAnalytics.logEvent({ name: 'ad_impression', params: { ad_type: 'interstitial' } });
  } catch (err) {
    console.error('Show Interstitial Error', err);
    document.getElementById('ad-loading-screen').classList.add('hidden');
    if (adLoadingTimeout) {
      clearTimeout(adLoadingTimeout);
      adLoadingTimeout = null;
    }
  }
}

async function showRewardedAd() {
  if (isAdLoading) return; // Prevent multiple taps
  isAdLoading = true;

  const reviveBtn = document.getElementById('revive-btn');
  const originalText = reviveBtn.innerText;
  reviveBtn.innerText = '⏳';
  reviveBtn.style.opacity = '0.6';
  reviveBtn.style.pointerEvents = 'none';

  try {
    document.getElementById('ad-loading-screen').classList.remove('hidden');

    // Safety timeout: auto-hide after 5 seconds
    if (adLoadingTimeout) clearTimeout(adLoadingTimeout);
    adLoadingTimeout = setTimeout(() => {
      console.warn('Ad safety timeout reached, hiding loading screen');
      document.getElementById('ad-loading-screen').classList.add('hidden');
      adLoadingTimeout = null;
    }, 5000);

    // 2-second delay for rewards as well
    await new Promise(resolve => setTimeout(resolve, 2000));

    const options = {
      adId: 'ca-app-pub-3539090903954344/5831162433',
      isTesting: false
    };
    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();
    FirebaseAnalytics.logEvent({ name: 'ad_impression', params: { ad_type: 'rewarded' } });
  } catch (err) {
    console.error('Show Rewarded Error', err);
    document.getElementById('ad-loading-screen').classList.add('hidden');
    if (adLoadingTimeout) {
      clearTimeout(adLoadingTimeout);
      adLoadingTimeout = null;
    }
  } finally {
    isAdLoading = false;
    reviveBtn.innerText = originalText;
    reviveBtn.style.opacity = '1';
    reviveBtn.style.pointerEvents = 'auto';
  }
}

async function showBannerAd() {
  try {
    if (!isBannerCreated) {
      await AdMob.showBanner({
        adId: 'ca-app-pub-3539090903954344/8982185366',
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: false,
      });
      isBannerCreated = true;
      FirebaseAnalytics.logEvent({ name: 'ad_impression', params: { ad_type: 'banner' } });
    } else {
      await AdMob.resumeBanner();
    }
  } catch (err) {
    console.warn('Banner ad error:', err);
  }
}

async function hideBannerAd() {
  try {
    await AdMob.hideBanner();
  } catch (err) {
    // Ignore if no banner active
  }
}

function applyReviveReward() {
  // Hide Game Over
  document.getElementById('game-over').classList.add('hidden');
  hasUsedRevive = true;

  // Re-show banner (it may have been dismissed during ad playback)
  showBannerAd();

  // Show confirmation screen before resuming timer
  const textEl = document.getElementById('reward-ready-text');
  if (currentMode === 'timeattack') {
    textEl.innerHTML = "Bonus Earned!<br>⏱️ +15 Seconds";
  } else {
    textEl.innerHTML = "Life Restored!<br>Continue Playing";
  }
  document.getElementById('reward-ready-screen').classList.remove('hidden');
}

function shuffleBoard() {
  // Extract all non-null items
  const flatItems = [];
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] !== null) {
        flatItems.push(grid[r][c].color);
        // Remove old dom elements visually for a fresh drop
        const bol = grid[r][c];
        if (bol.el && bol.el.parentNode) bol.el.parentNode.removeChild(bol.el);
        grid[r][c] = null;
      }
    }
  }

  // Shuffle colors simple
  flatItems.sort(() => Math.random() - 0.5);

  uiGrid.innerHTML = '';
  elementPositionMap = new WeakMap();

  let index = 0;
  for (let c = 0; c < currentCols; c++) {
    for (let r = currentRows - 1; r >= 0; r--) {
      if (index < flatItems.length) {
        createBolita(r, c, flatItems[index]);
        index++;
      }
    }
  }

  // Drop gravity just in case
  applyGravity();
  applyHorizontalShift();

  if (!checkPossibleMoves()) {
    // In lucky event it's still stuck, just reroll again
    shuffleBoard();
  }
}

function checkExistingSession() {
  const savedUser = localStorage.getItem('bolitasUser');
  currentLevelIndex = parseInt(localStorage.getItem('bolitasLevel')) || 0;
  document.getElementById('current-level-display').innerText = currentLevelIndex + 1;
  updateModeButtons();

  // Always make the overlay visible
  document.getElementById('login-screen').classList.remove('hidden');

  if (savedUser) {
    // Returning user: skip login form, show mode menu directly
    currentUser = savedUser;
    // document.getElementById('current-username').innerText = currentUser;
    document.getElementById('auth-panel').classList.add('hidden');
    document.getElementById('main-menu-panel').classList.remove('hidden');
  } else {
    // New user: show login form only
    document.getElementById('auth-panel').classList.remove('hidden');
    document.getElementById('main-menu-panel').classList.add('hidden');
  }
}

function handleLogin() {
  const input = document.getElementById('username-input');
  const alias = input.value.trim();
  const errorMsg = document.getElementById('login-error');

  if (alias.length < 3) {
    errorMsg.innerText = '❌ Min 3+ chars';
    errorMsg.classList.remove('hidden');
    return;
  }

  errorMsg.classList.add('hidden');
  currentUser = alias;
  localStorage.setItem('bolitasUser', alias);
  // document.getElementById('current-username').innerText = currentUser;

  // If tutorial hasn't been done, go directly to tutorial (which starts Level 1 after)
  if (!localStorage.getItem('bolitasTutorialDone')) {
    currentMode = 'adventure';
    currentLevelIndex = 0;
    showTutorial();
    return;
  }

  document.getElementById('auth-panel').classList.add('hidden');
  document.getElementById('main-menu-panel').classList.remove('hidden');
}

function logoutUser() {
  localStorage.removeItem('bolitasUser');
  localStorage.removeItem('bolitasLevel');
  currentUser = null;
  currentLevelIndex = 0;
  document.getElementById('current-level-display').innerText = '1';
  updateModeButtons();
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('auth-panel').classList.remove('hidden');
  document.getElementById('main-menu-panel').classList.add('hidden');
}

async function showLeaderboard() {
  document.getElementById('leaderboard-screen').classList.remove('hidden');
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li>⏳</li>';

  try {
    const scores = await getLeaderboard();
    listEl.innerHTML = '';
    if (scores.length === 0) {
      listEl.innerHTML = '<li>—</li>';
      return;
    }

    scores.forEach((s, i) => {
      const li = document.createElement('li');
      if (currentUser && s.username === currentUser) {
        li.classList.add('highlight');
      }
      li.innerHTML = `
  < span class="lb-rank" > #${i + 1}</span >
        <span class="lb-name">${s.username}</span>
        <span class="lb-score">${s.score} pt</span>
`;
      listEl.appendChild(li);
    });
  } catch (e) {
    listEl.innerHTML = '<li>❌</li>';
    console.error(e);
  }
}

function hideLeaderboard() {
  document.getElementById('leaderboard-screen').classList.add('hidden');
}

// --- Local Notifications (Retention) ---
const INACTIVITY_NOTIFICATIONS = [
  { id: 101, delayH: 8, title: '¡Las bolitas te extrañan! 👀', body: 'Llevas 8 horas sin jugar, ¿qué tal una partida rápida de Gloop?' },
  { id: 102, delayH: 24, title: '¡Récords por batir! 🏆', body: 'Tu puntuación máxima te está esperando. ¡Entra y supérala!' },
  { id: 103, delayH: 48, title: 'Modo Zen te espera 🧘‍♀️', body: 'Hace dos días que no juegas. Relájate conectando colores sin límite de tiempo.' },
  { id: 104, delayH: 72, title: '¡El reto se pone difícil! 🔥', body: 'Nuevos desafíos y niveles te esperan. ¿Te atreves?' },
  { id: 105, delayH: 120, title: '¡Ayuda! Estamos atascadas 🆘', body: 'Hace 5 días que no limpias el tablero. ¡Ven a hacer estallar colores!' },
  { id: 106, delayH: 168, title: 'Tiempo Extra de regalo 🎁', body: '¡Ha pasado una semana! Entra ahora y revive tu próxima partida totalmente gratis.' },
  { id: 107, delayH: 240, title: 'Alerta Máxima Nivel 100 🚨', body: 'Llevas 10 días fuera. ¡El tablero está a punto de desbordarse, entra rápido!' }
];

// Ask for notification permission at app startup (does not schedule anything yet)
async function requestNotificationPermission() {
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (e) {
    console.warn('Notification permission request failed:', e);
  }
}

async function setupInactivityNotifications() {
  try {
    // Request permission if not determined/denied (Android 13+)
    let permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      permStatus = await LocalNotifications.requestPermissions();
      if (permStatus.display !== 'granted') return; // User denied
    }

    // Cancel all previously scheduled notifications to reset the timer
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    // Schedule new ones
    const now = Date.now();
    const notificationsToSchedule = INACTIVITY_NOTIFICATIONS.map(n => {
      const scheduleTime = new Date(now + n.delayH * 60 * 60 * 1000);
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: scheduleTime },
        smallIcon: 'ic_launcher_round'
      };
    });

    await LocalNotifications.schedule({ notifications: notificationsToSchedule });
  } catch (e) {
    console.error('Error setup local notifications:', e);
  }
}
// ---------------------------------------

function returnToMainMenu() {
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('main-menu-panel').classList.remove('hidden');
  document.getElementById('auth-panel').classList.add('hidden');
  document.getElementById('current-level-display').innerText = currentLevelIndex + 1;
  updateModeButtons();
  clearInterval(timerInterval);
  bgmAudio.pause();

  if (currentMode === 'zen') {
    showInterstitialAd();
  }
}

function startGame() {
  // Show tutorial before adventure mode level 1 (only once)
  if (currentMode === 'adventure' && currentLevelIndex === 0 && !localStorage.getItem('bolitasTutorialDone')) {
    showTutorial();
    return;
  }

  document.getElementById('login-screen').classList.add('hidden');
  if (isAudioEnabled) {
    bgmAudio.play().catch(e => console.log('Autoplay prevented'));
  }
  FirebaseAnalytics.logEvent({ name: 'level_start', params: { mode: currentMode, level: currentLevelIndex + 1 } });
  initGame();
}

function initGame(isRevive = false) {
  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('pass-level-btn').classList.add('hidden');
  showBannerAd();
  uiGrid.innerHTML = '';

  if (!isRevive) {
    score = 0;
    comboMultiplier = 1;
    hasUsedRevive = false;
    levelCompleted = false;

    // Reset inactivity notifications timer
    setupInactivityNotifications();
  }

  updateScore(0);
  isAnimating = false;
  selectedGroup = [];
  hintedElements = [];
  clearInterval(timerInterval);

  // Configure grid based on mode
  const leaderboardBtn = document.getElementById('show-leaderboard-btn');

  if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    currentRows = config.rows;
    currentCols = config.cols;
    currentColors = config.colors;
    currentColorSet = COLORS;
    uiHeaderMode.innerText = `LVL ${currentLevelIndex + 1} `;
    leaderboardBtn.classList.add('hidden');
  } else if (currentMode === 'zen') {
    currentRows = 10;
    currentCols = 10;
    currentColorSet = ZEN_COLORS;
    currentColors = ZEN_COLORS.length;
    uiHeaderMode.innerText = `🧘 Zen`;
    leaderboardBtn.classList.add('hidden');
  } else if (currentMode === 'timeattack') {
    currentRows = 8;
    currentCols = 8;
    currentColorSet = COLORS;
    currentColors = 5;
    timeRemaining = isRevive ? 15 : 60;
    uiHeaderMode.innerText = `⏱️ Ranking`;
    leaderboardBtn.classList.remove('hidden');
    startTimer();
  }

  // Set CSS variables
  document.documentElement.style.setProperty('--rows', currentRows);
  document.documentElement.style.setProperty('--cols', currentCols);

  // Set aspect ratio based on dimension
  uiGrid.style.aspectRatio = `${currentCols} / ${currentRows}`;

  grid = Array.from({ length: currentRows }, () => new Array(currentCols).fill(null));

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      let color = null;
      let fails = 0;

      if (currentMode === 'adventure') {
        fails = parseInt(localStorage.getItem('bolitasLevelFails') || '0');
      }

      // Invisible adaptive difficulty: cluster colors if failed >= 3 times
      if (fails >= 3) {
        const clusterChance = Math.min(0.7, (fails - 2) * 0.15);
        if (Math.random() < clusterChance) {
          const neighbors = [];
          if (r > 0 && grid[r - 1][c]) neighbors.push(grid[r - 1][c].color);
          if (c > 0 && grid[r][c - 1]) neighbors.push(grid[r][c - 1].color);
          if (neighbors.length > 0) {
            color = neighbors[Math.floor(Math.random() * neighbors.length)];
          }
        }
      }

      if (!color) {
        color = currentColorSet[Math.floor(Math.random() * currentColors)];
      }

      createBolita(r, c, color);
    }
  }

  // Ensure at least 3 valid groups are available at start
  if (countValidGroups() < 3) {
    initGame(isRevive); // Reroll until board is playable enough
  } else {
    resetHintTimer();
  }
}

function startTimer() {
  clearInterval(timerInterval); // prevent duplicate timers
  updateScore(0);
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateScore(0);
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      showGameOver(true);
    }
  }, 1000);
}

function createBolita(r, c, color) {
  const el = document.createElement('div');
  el.className = 'bolita';
  el.dataset.color = color;
  el.style.setProperty('--row', r);
  el.style.setProperty('--col', c);

  el.addEventListener('click', () => handleBolitaClick(r, c, el));

  uiGrid.appendChild(el);

  const bolitaObj = {
    color,
    el,
    r,
    c
  };
  grid[r][c] = bolitaObj;
  elementPositionMap.set(el, bolitaObj);
}

async function handleBolitaClick(startR, startC, el) {
  if (isAnimating) return;

  // Find current position in grid as it might have moved
  const currentPos = findBolitaByElement(el);
  if (!currentPos) return;

  const { r, c } = currentPos;

  // Check if it's already selected
  const isAlreadySelected = selectedGroup.some(b => b.r === r && b.c === c);

  if (isAlreadySelected) {
    // Proceed to pop
    isAnimating = true;
    clearHint();
    clearTimeout(hintTimeout);

    // Pop animation
    const groupToPop = [...selectedGroup];
    selectedGroup = []; // clear selection
    clearSelectionOutline();
    const currentTime = Date.now();

    // Play Pop Sound + Haptic feedback on mobile
    if (isAudioEnabled) playPopSound(groupToPop.length);
    if (navigator.vibrate) {
      navigator.vibrate(groupToPop.length >= 8 ? 60 : 30);
    }


    groupToPop.forEach(bolita => {
      bolita.el.classList.remove('selected');
      bolita.el.classList.add('popped');
      grid[bolita.r][bolita.c] = null; // remove from logic grid immediately
    });

    // Add Score
    let points = calculatePoints(groupToPop.length);
    updateScore(points);

    // Spawn floating score visually at the clicked bolita
    spawnFloatingScore(points, 1, el);

    // Wait for popping animation to start before moving others
    await new Promise(res => setTimeout(res, 200));

    applyGravity();
    if (currentMode === 'zen') {
      refillBoard();
    } else {
      applyHorizontalShift();
    }

    // Clean up DOM elements
    setTimeout(() => {
      groupToPop.forEach(bolita => {
        if (bolita.el.parentNode) bolita.el.parentNode.removeChild(bolita.el);
      });
      isAnimating = false;

      // If tutorial is active, fire progress on pop completion
      if (isTutorialActive) {
        handleTutorialProgress();
        return;
      }

      // Check if the board is completely clear
      if (isBoardClear()) {
        showCelebration();
        return;
      }

      if (!checkPossibleMoves()) {
        // In adventure mode, check if the target was reached
        if (currentMode === 'adventure') {
          const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
          if (score >= config.target) {
            document.getElementById('pass-level-btn').classList.add('hidden');
            handleLevelComplete();
          } else {
            showGameOver(false);
          }
        } else {
          showGameOver(false);
        }
      } else {
        resetHintTimer();
      }
    }, 400); // 400ms matches CSS transition
  } else {
    // Select new group

    // Clear previous selection visually
    selectedGroup.forEach(b => {
      if (b.el) b.el.classList.remove('selected');
    });
    selectedGroup = [];
    clearSelectionOutline();

    const targetColor = grid[r][c].color;
    const group = [];
    const visited = new Set();

    function dfs(currR, currC) {
      if (currR < 0 || currR >= currentRows || currC < 0 || currC >= currentCols) return;
      const key = `${currR},${currC}`;
      if (visited.has(key)) return;

      if (!grid[currR][currC] || grid[currR][currC].color !== targetColor) return;

      visited.add(key);
      group.push(grid[currR][currC]);

      dfs(currR + 1, currC);
      dfs(currR - 1, currC);
      dfs(currR, currC + 1);
      dfs(currR, currC - 1);
    }

    dfs(r, c);

    if (group.length >= MIN_GROUP) {
      if (isAudioEnabled) playSelectSound();
      selectedGroup = group;
      selectedGroup.forEach(b => b.el.classList.add('selected'));
      drawSelectionOutline(selectedGroup);
      // If tutorial is active, advance to 'pop' phase
      if (isTutorialActive) handleTutorialProgress();
    } else {
      if (isAudioEnabled) playErrorSound();
    }
    resetHintTimer();
  }
}

function spawnFloatingScore(points, combo, targetEl) {
  const floater = document.createElement('div');
  floater.className = 'floating-score';
  floater.innerText = `+${points}`;

  // Position it where the click happened roughly
  const rect = targetEl.getBoundingClientRect();
  const parentRect = uiGrid.getBoundingClientRect();

  floater.style.left = `${rect.left - parentRect.left + (rect.width / 2)}px`;
  floater.style.top = `${rect.top - parentRect.top}px`;

  uiGrid.appendChild(floater);

  // Clean up
  setTimeout(() => {
    if (floater.parentNode) floater.parentNode.removeChild(floater);
  }, 1000);
}

function findBolitaByElement(el) {
  const obj = elementPositionMap.get(el);
  if (obj) return { r: obj.r, c: obj.c };
  return null;
}

function applyGravity() {
  for (let c = 0; c < currentCols; c++) {
    let emptyRow = currentRows - 1;
    // Scan from bottom to top
    for (let r = currentRows - 1; r >= 0; r--) {
      const item = grid[r][c];
      if (item !== null) {
        if (r !== emptyRow) {
          // Move item down to emptyRow
          grid[emptyRow][c] = item;
          grid[r][c] = null;
          item.r = emptyRow;
          item.c = c;
          item.el.style.setProperty('--row', emptyRow);
        }
        emptyRow--;
      }
    }
  }
}

function applyHorizontalShift() {
  let emptyCols = 0;

  for (let c = 0; c < currentCols; c++) {
    // Check if entire column is empty
    let isColEmpty = true;
    for (let r = 0; r < currentRows; r++) {
      if (grid[r][c] !== null) {
        isColEmpty = false;
        break;
      }
    }

    if (isColEmpty) {
      emptyCols++;
    } else if (emptyCols > 0) {
      // Shift column to the left by emptyCols
      const newC = c - emptyCols;
      for (let r = 0; r < currentRows; r++) {
        const item = grid[r][c];
        if (item !== null) {
          grid[r][newC] = item;
          grid[r][c] = null;
          item.c = newC;
          item.el.style.setProperty('--col', newC);
        }
      }
    }
  }
}

function refillBoard() {
  for (let c = 0; c < currentCols; c++) {
    for (let r = 0; r < currentRows; r++) {
      if (grid[r][c] === null) {
        let color = null;
        let fails = 0;

        if (currentMode === 'adventure') {
          fails = parseInt(localStorage.getItem('bolitasLevelFails') || '0');
        }

        if (fails >= 3) {
          const clusterChance = Math.min(0.7, (fails - 2) * 0.15);
          if (Math.random() < clusterChance) {
            const neighbors = [];
            // Check below since we fill from top
            if (r < currentRows - 1 && grid[r + 1][c]) neighbors.push(grid[r + 1][c].color);
            if (c > 0 && grid[r][c - 1]) neighbors.push(grid[r][c - 1].color);
            if (c < currentCols - 1 && grid[r][c + 1]) neighbors.push(grid[r][c + 1].color);
            if (neighbors.length > 0) {
              color = neighbors[Math.floor(Math.random() * neighbors.length)];
            }
          }
        }

        if (!color) {
          color = currentColorSet[Math.floor(Math.random() * currentColors)];
        }

        createBolita(r, c, color);

        // Little trick to animate falling from top
        const b = grid[r][c];
        b.el.style.transition = 'none';
        b.el.style.setProperty('--row', r - currentRows);

        // Force reflow
        b.el.offsetHeight;
        b.el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s';
        b.el.style.setProperty('--row', r);
      }
    }
  }
}

// --- Selection group outline (SVG marching ants) ---
function drawSelectionOutline(group) {
  const svg = document.getElementById('selection-outline');
  svg.innerHTML = '';
  if (!group || group.length === 0) return;

  const gridEl = document.getElementById('grid');
  const cw = gridEl.offsetWidth / currentCols;
  const ch = gridEl.offsetHeight / currentRows;

  const sel = new Set(group.map(b => `${b.r},${b.c}`));
  let pathData = '';

  for (const b of group) {
    const { r, c } = b;
    const x = c * cw, y = r * ch;

    const edges = [
      [!sel.has(`${r - 1},${c}`), x, y, x + cw, y], // top
      [!sel.has(`${r + 1},${c}`), x, y + ch, x + cw, y + ch], // bottom
      [!sel.has(`${r},${c - 1}`), x, y, x, y + ch], // left
      [!sel.has(`${r},${c + 1}`), x + cw, y, x + cw, y + ch], // right
    ];

    for (const [draw, x1, y1, x2, y2] of edges) {
      if (!draw) continue;
      pathData += `M ${x1} ${y1} L ${x2} ${y2} `;
    }
  }

  if (pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }
}

function clearSelectionOutline() {
  const svg = document.getElementById('selection-outline');
  if (svg) svg.innerHTML = '';
}
// -------------------------------------------------------


function calculatePoints(count) {
  if (count <= 3) return 100;
  if (count === 4) return 300;
  if (count === 5) return 600;
  if (count === 6) return 1200;
  return 2000;
}

function updateScore(points) {
  score += points;
  if (currentMode === 'timeattack') {
    uiHeaderScoreDetails.innerText = `⭐ ${score} ⏱️ ${timeRemaining}`;
  } else if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    uiHeaderScoreDetails.innerText = `⭐ ${score} / ${config.target}`;
    // Show pass-level button when target is reached
    if (score >= config.target && !levelCompleted) {
      levelCompleted = true;
      document.getElementById('pass-level-btn').classList.remove('hidden');
    }
  } else {
    uiHeaderScoreDetails.innerText = `⭐ ${score}`;
  }
}

function updateModeButtons() {
  const zenBtn = document.getElementById('mode-zen-btn');
  const taBtn = document.getElementById('mode-timeattack-btn');

  const lvl = parseInt(localStorage.getItem('bolitasLevel') || '1');

  // Time Attack (Level 30+)
  if (lvl >= 30) {
    taBtn.classList.remove('locked-mode');
    taBtn.querySelector('small').textContent = '8×8 🏆';
    if (!localStorage.getItem('alerted_timeattack_30')) {
      localStorage.setItem('alerted_timeattack_30', 'true');
      document.getElementById('unlocked-mode-name').innerText = "⏱️";
      document.getElementById('unlocked-mode-desc').innerText = "8×8 🏆";
      document.getElementById('mode-unlocked-screen').classList.remove('hidden');
    }

    // Add glow and badge if unlocked but not played yet
    if (!localStorage.getItem('hasPlayedTimeAttack')) {
      taBtn.classList.add('new-mode-glow');
      taBtn.querySelector('span').innerHTML = '⏱️ Ranking <span class="new-badge">🆕</span>';
    } else {
      taBtn.classList.remove('new-mode-glow');
      taBtn.querySelector('span').innerHTML = '⏱️ Ranking';
    }
  } else {
    taBtn.classList.add('locked-mode');
    taBtn.querySelector('span').innerHTML = '⏱️ Ranking 🔒';
    taBtn.querySelector('small').textContent = '🔒 30';
    taBtn.classList.remove('new-mode-glow');
  }

  // Zen Mode (Level 50+)
  if (lvl >= 50) {
    zenBtn.classList.remove('locked-mode');
    zenBtn.querySelector('small').textContent = '10×10 ∞';
    if (!localStorage.getItem('alerted_zen_50')) {
      localStorage.setItem('alerted_zen_50', 'true');
      document.getElementById('unlocked-mode-name').innerText = "🧘";
      document.getElementById('unlocked-mode-desc').innerText = "∞";
      document.getElementById('mode-unlocked-screen').classList.remove('hidden');
    }

    if (!localStorage.getItem('hasPlayedZen')) {
      zenBtn.classList.add('new-mode-glow');
      zenBtn.querySelector('span').innerHTML = '🧘 Zen <span class="new-badge">🆕</span>';
    } else {
      zenBtn.classList.remove('new-mode-glow');
      zenBtn.querySelector('span').innerHTML = '🧘 Zen';
    }
  } else {
    zenBtn.classList.add('locked-mode');
    zenBtn.querySelector('span').innerHTML = '🧘 Zen 🔒';
    zenBtn.querySelector('small').textContent = '🔒 50';
    zenBtn.classList.remove('new-mode-glow');
  }
}

function checkPossibleMoves() {
  return findValidGroup() !== null;
}

// Returns the first valid group found, or null if none
// Count how many valid groups exist on the board
function countValidGroups() {
  const visited = new Set();
  let count = 0;

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (!grid[r][c]) continue;

      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      const targetColor = grid[r][c].color;
      const groupSize = [];
      const queue = [{ r, c }];
      let qIdx = 0;
      const localVisited = new Set();
      localVisited.add(key);

      while (qIdx < queue.length) {
        const curr = queue[qIdx++];
        groupSize.push(curr);
        visited.add(`${curr.r},${curr.c}`);

        const neighbors = [
          { r: curr.r + 1, c: curr.c },
          { r: curr.r - 1, c: curr.c },
          { r: curr.r, c: curr.c + 1 },
          { r: curr.r, c: curr.c - 1 }
        ];

        for (const n of neighbors) {
          if (n.r >= 0 && n.r < currentRows && n.c >= 0 && n.c < currentCols && grid[n.r][n.c] && grid[n.r][n.c].color === targetColor) {
            const nKey = `${n.r},${n.c}`;
            if (!localVisited.has(nKey)) {
              localVisited.add(nKey);
              queue.push(n);
            }
          }
        }
      }

      if (groupSize.length >= MIN_GROUP) {
        count++;
        if (count >= 3) return count; // Early exit once we have enough
      }
    }
  }
  return count;
}

function findValidGroup() {
  const visited = new Set();

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (!grid[r][c]) continue;

      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      const targetColor = grid[r][c].color;
      const group = [];

      const queue = [{ r, c }];
      const localVisited = new Set();
      localVisited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        group.push(curr);
        visited.add(`${curr.r},${curr.c}`);

        const neighbors = [
          { r: curr.r + 1, c: curr.c },
          { r: curr.r - 1, c: curr.c },
          { r: curr.r, c: curr.c + 1 },
          { r: curr.r, c: curr.c - 1 }
        ];

        for (const n of neighbors) {
          if (n.r >= 0 && n.r < currentRows && n.c >= 0 && n.c < currentCols) {
            const nKey = `${n.r},${n.c}`;
            if (!localVisited.has(nKey) && grid[n.r][n.c] && grid[n.r][n.c].color === targetColor) {
              localVisited.add(nKey);
              queue.push(n);
            }
          }
        }
      }

      if (group.length >= MIN_GROUP) {
        return group;
      }
    }
  }

  return null;
}

// Hint system: highlight a valid group after inactivity
function resetHintTimer() {
  clearTimeout(hintTimeout);
  clearHint();
  hintTimeout = setTimeout(showHint, HINT_DELAY);
}

function clearHint() {
  for (const el of hintedElements) {
    el.classList.remove('hint');
  }
  hintedElements = [];
}

function showHint() {
  const group = findValidGroup();
  if (!group) return;

  group.forEach(({ r, c }) => {
    if (grid[r][c] && grid[r][c].el) {
      grid[r][c].el.classList.add('hint');
      hintedElements.push(grid[r][c].el);
    }
  });
}

async function showGameOver(timeout = false) {
  if (isAudioEnabled) playGameOverSound();
  clearInterval(timerInterval);

  const title = document.querySelector('#game-over h2');
  if (timeout) {
    title.innerText = "⏱️ Time up!";
  } else {
    title.innerText = "🚫 You lose";
  }

  document.getElementById('final-score').innerText = score;
  if (currentMode === 'adventure' && !timeout) {
    document.getElementById('play-again-btn').innerText = "🔄 Retry";
    document.getElementById('play-again-btn').dataset.action = 'retry';

    // Track failures for dynamic difficulty
    let fails = parseInt(localStorage.getItem('bolitasLevelFails') || '0');
    localStorage.setItem('bolitasLevelFails', fails + 1);
  } else {
    document.getElementById('play-again-btn').innerText = "🏠";
    document.getElementById('play-again-btn').dataset.action = 'menu';
  }

  const reviveBtn = document.getElementById('revive-btn');
  if ((currentMode === 'timeattack' || currentMode === 'adventure') && !hasUsedRevive && score > 0) {
    if (currentMode === 'timeattack') {
      reviveBtn.innerText = "🎥 AD +15s";
    } else {
      reviveBtn.innerText = "🎥 AD Continue";
    }
    reviveBtn.classList.remove('hidden');
    prepareRewarded(); // pre-load in background
  } else {
    reviveBtn.classList.add('hidden');
  }

  document.getElementById('game-over').classList.remove('hidden');

  FirebaseAnalytics.logEvent({
    name: 'game_over',
    params: {
      mode: currentMode,
      level: currentLevelIndex + 1,
      score: score,
      timeout: timeout
    }
  });

  // Show interstitial immediately for modes that don't have a rewarded button flow
  // (Zen never has the revive btn, so show interstitial now)
  if (currentMode === 'zen') {
    prepareInterstitial().then(() => showInterstitialAd());
  }

  if (currentUser && score > 0 && currentMode === 'timeattack') {
    try {
      await saveScore(currentUser, score);
    } catch (e) {
      console.error("Failed to save score:", e);
    }
  }
}

function handleLevelComplete() {
  if (isAudioEnabled) playGameOverSound(); // Maybe play a success sound later
  clearInterval(timerInterval);

  currentLevelIndex++;
  localStorage.setItem('bolitasLevel', currentLevelIndex);
  localStorage.removeItem('bolitasLevelFails'); // Reset fails on success

  FirebaseAnalytics.logEvent({
    name: 'level_complete',
    params: {
      mode: 'adventure',
      level: currentLevelIndex // This is the level that was just completed
    }
  });

  updateModeButtons();

  const title = document.querySelector('#game-over h2');
  const WIN_TITLES = ['Great! 🎉', 'WOW! 🔥', 'Winner! 🏆', 'Amazing! ⚡', 'Brilliant! ✨', 'Nailed it! 💥'];
  title.innerText = WIN_TITLES[Math.floor(Math.random() * WIN_TITLES.length)];
  document.getElementById('final-score').innerText = score;
  document.getElementById('play-again-btn').innerText = "▶️ Next LVL";
  document.getElementById('play-again-btn').dataset.action = 'next';
  document.getElementById('revive-btn').classList.add('hidden');
  document.getElementById('game-over').classList.remove('hidden');

  // Interstitial every 10 levels starting from level 10
  if (currentLevelIndex >= 10 && currentLevelIndex % 10 === 0) {
    prepareInterstitial().then(() => showInterstitialAd());
  }

  // Mode unlock notifications are handled automatically by updateModeButtons() when called above
  // if currentLevelIndex reaches 30 or 50. No need for alerts here.
}

function isBoardClear() {
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] !== null) return false;
    }
  }
  return true;
}

function showCelebration() {
  clearInterval(timerInterval);
  clearTimeout(hintTimeout);

  document.getElementById('celebration-score').innerText = score;
  document.getElementById('clear-celebration').classList.remove('hidden');

  // Spawn confetti particles
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#ff3b5c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ff6b6b', '#06d6a0', '#ffd166'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${6 + Math.random() * 8}px`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    container.appendChild(piece);
  }
}

// Tutorial system — interactive mini-level
let isTutorialActive = false;
let tutorialPhase = 'select'; // 'select' | 'pop'

function positionTutorialHand(targetEl) {
  const hand = document.getElementById('tutorial-hand');
  const screen = document.getElementById('tutorial-screen');
  const containerRect = document.getElementById('game-container').getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  // Center the hand over the target bolita
  const left = (targetRect.left - containerRect.left) + targetRect.width / 2;
  const top = (targetRect.top - containerRect.top) + targetRect.height / 2;

  hand.style.left = `${left}px`;
  hand.style.top = `${top}px`;
  hand.style.transform = 'translate(-50%, -70%)';
  hand.style.display = 'block';

  screen.classList.remove('hidden');
}

function hideTutorialHand() {
  document.getElementById('tutorial-hand').style.display = 'none';
  document.getElementById('tutorial-screen').classList.add('hidden');
}

function showTutorial() {
  isTutorialActive = true;
  tutorialPhase = 'select';

  // Hide main menu, show game UI
  document.getElementById('login-screen').classList.add('hidden');
  if (isAudioEnabled) {
    bgmAudio.play().catch(e => console.log('Autoplay prevented'));
  }

  // Set up a 3x3 grid
  currentMode = 'adventure';
  currentRows = 3;
  currentCols = 3;
  currentColorSet = COLORS;
  score = 0;
  selectedGroup = [];
  isAnimating = false;
  hintedElements = [];

  // Update header
  uiHeaderMode.innerText = `📚 Tutorial`;
  uiHeaderScoreDetails.innerText = `Learn the basics`;

  document.getElementById('game-over').classList.add('hidden');
  document.getElementById('pass-level-btn').classList.add('hidden');
  showBannerAd();
  uiGrid.innerHTML = '';

  // Set CSS variables
  document.documentElement.style.setProperty('--rows', currentRows);
  document.documentElement.style.setProperty('--cols', currentCols);
  uiGrid.style.aspectRatio = `${currentCols} / ${currentRows}`;

  // Build 3x3 grid
  // L-shape green: (0,0), (1,0), (1,1)
  // Fixed fillers — no groups of 3 possible
  grid = Array.from({ length: currentRows }, () => new Array(currentCols).fill(null));

  const greenPos = new Set(['0,0', '1,0', '1,1']);
  const fillerLayout = [
    [null, 'red', 'blue'],
    [null, null, 'red'],
    ['blue', 'red', 'blue'],
  ];

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (greenPos.has(`${r},${c}`)) {
        createBolita(r, c, 'green');
      } else {
        createBolita(r, c, fillerLayout[r][c]);
      }
    }
  }

  // Apply pulsing hint to green balls
  greenPos.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (grid[r][c] && grid[r][c].el) {
      grid[r][c].el.classList.add('hint');
      hintedElements.push(grid[r][c].el);
    }
  });

  // Show step 1 instruction
  // Point at the middle green bolita (1,0)
  positionTutorialHand(grid[1][0].el);
}

// Called from handleBolitaClick when tutorial is active
function handleTutorialProgress() {
  if (tutorialPhase === 'select') {
    // Green group was just selected — advance to pop phase
    tutorialPhase = 'pop';
    // Hand stays in place — user needs to tap same group again to pop it
  } else if (tutorialPhase === 'pop') {
    // Green group was just popped — tutorial complete
    isTutorialActive = false;
    hideTutorialHand();
    document.getElementById('tutorial-text').classList.add('hidden');
    localStorage.setItem('bolitasTutorialDone', 'true');

    // Restore footer text
    document.querySelector('footer').innerHTML =
      '<p>🔵🔴🟢 × 3+</p>';

    // Start Level 1 after pop animation finishes
    setTimeout(() => {
      currentLevelIndex = 0;
      startGame();
    }, 700);
  }
}
