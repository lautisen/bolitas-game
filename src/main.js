import './style.css';
import { saveScore, getLeaderboard } from './firebase.js';
import { playSelectSound, playPopSound, playErrorSound, playGameOverSound } from './audio.js';
import { checkAppVersion } from './versionCheck.js';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

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
    const target = Math.round(80 + (i * 60) + (i * i * 1.5));
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
let uiScore;
let uiGrid;
let isAnimating = false;
let selectedGroup = [];
let currentUser = null;
let comboMultiplier = 1;
let lastPopTime = 0;
let comboTimeout = null;

let isAudioEnabled = true;
let isColorblindEnabled = false;
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

document.addEventListener('DOMContentLoaded', () => {
  uiScore = document.getElementById('score');
  uiGrid = document.getElementById('grid');

  // Check for updates
  checkAppVersion();

  // UI Handlers
  document.getElementById('restart-btn').addEventListener('click', () => initGame());
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
  document.getElementById('logout-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.add('hidden');
    logoutUser();
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

  document.getElementById('audio-toggle').addEventListener('change', (e) => {
    isAudioEnabled = e.target.checked;
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
    if (isColorblindEnabled) {
      document.body.classList.add('color-blind-mode');
    } else {
      document.body.classList.remove('color-blind-mode');
    }
  });

  // Game Mode Selection Handlers
  document.getElementById('mode-levels-btn').addEventListener('click', () => {
    currentMode = 'adventure';
    startGame();
  });
  document.getElementById('mode-zen-btn').addEventListener('click', () => {
    if (currentLevelIndex < 49) {
      alert(`El Modo Zen se desbloquea en el Nivel 50. Estás en el Nivel ${currentLevelIndex + 1}.`);
      return;
    }
    currentMode = 'zen';
    startGame();
  });
  document.getElementById('mode-timeattack-btn').addEventListener('click', () => {
    if (currentLevelIndex < 29) {
      alert(`El Modo Contrarreloj se desbloquea en el Nivel 30. Estás en el Nivel ${currentLevelIndex + 1}.`);
      return;
    }
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

    // Rewarded ad listeners (v8 event names from source)
    const onRewarded = (rewardItem) => {
      console.log('User was rewarded', rewardItem);
      applyReviveReward();
    };
    AdMob.addListener('onRewardedVideoAdReward', onRewarded);

    // Also listen for ad dismissal to ensure we unpause/restore UI
    // just in case the reward event fires before dismissal completes
    AdMob.addListener('onRewardedVideoAdDismissed', () => {
      console.log('Rewarded Video Dismissed');
      showBannerAd();
    });

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

async function showInterstitialAd() {
  try {
    await AdMob.showInterstitial();
  } catch (err) {
    console.error('Show Interstitial Error', err);
  }
}

async function showRewardedAd() {
  if (isAdLoading) return; // Prevent multiple taps
  isAdLoading = true;

  const reviveBtn = document.getElementById('revive-btn');
  const originalText = reviveBtn.innerText;
  reviveBtn.innerText = '⏳ Cargando anuncio...';
  reviveBtn.style.opacity = '0.6';
  reviveBtn.style.pointerEvents = 'none';

  try {
    const options = {
      adId: 'ca-app-pub-3539090903954344/5831162433',
      isTesting: false
    };
    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();
  } catch (err) {
    console.error('Show Rewarded Error', err);
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
    textEl.innerHTML = "El tablero se ha rellenado.<br>¡Tienes 15 segundos extra!";
  } else {
    textEl.innerHTML = "El tablero se ha rellenado.<br>¡Sigue jugando!";
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
    document.getElementById('current-username').innerText = currentUser;
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
    errorMsg.innerText = 'El alias debe tener al menos 3 letras.';
    errorMsg.classList.remove('hidden');
    return;
  }

  errorMsg.classList.add('hidden');
  currentUser = alias;
  localStorage.setItem('bolitasUser', alias);
  document.getElementById('current-username').innerText = currentUser;
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
  listEl.innerHTML = '<li>Cargando...</li>';

  try {
    const scores = await getLeaderboard();
    listEl.innerHTML = '';
    if (scores.length === 0) {
      listEl.innerHTML = '<li>Aún no hay puntuaciones.</li>';
      return;
    }

    scores.forEach((s, i) => {
      const li = document.createElement('li');
      if (currentUser && s.username === currentUser) {
        li.classList.add('highlight');
      }
      li.innerHTML = `
        <span class="lb-rank">#${i + 1}</span>
        <span class="lb-name">${s.username}</span>
        <span class="lb-score">${s.score} pt</span>
      `;
      listEl.appendChild(li);
    });
  } catch (e) {
    listEl.innerHTML = '<li>Error al cargar leaderboard.</li>';
    console.error(e);
  }
}

function hideLeaderboard() {
  document.getElementById('leaderboard-screen').classList.add('hidden');
}

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
  initGame();
}

function initGame(isRevive = false) {
  document.getElementById('game-over').classList.add('hidden');
  showBannerAd();
  uiGrid.innerHTML = '';

  if (!isRevive) {
    score = 0;
    comboMultiplier = 1;
    hasUsedRevive = false;
    levelCompleted = false;
  }

  updateScore(0);
  isAnimating = false;
  selectedGroup = [];
  hintedElements = [];
  clearInterval(timerInterval);

  // Configure grid based on mode
  if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    currentRows = config.rows;
    currentCols = config.cols;
    currentColors = config.colors;
    currentColorSet = COLORS;
    // Update header to show level
    document.querySelector('.score-board h2').innerHTML = `Nivel ${currentLevelIndex + 1} — <span id="score">0</span>`;
    uiScore = document.getElementById('score');
  } else if (currentMode === 'zen') {
    currentRows = 10;
    currentCols = 10;
    currentColorSet = ZEN_COLORS;
    currentColors = ZEN_COLORS.length;
    // Restore header for non-adventure modes
    document.querySelector('.score-board h2').innerHTML = `Puntos: <span id="score">0</span>`;
    uiScore = document.getElementById('score');
  } else if (currentMode === 'timeattack') {
    currentRows = 8;
    currentCols = 8;
    currentColorSet = COLORS;
    currentColors = 5; // Time Attack: more colors for challenge
    timeRemaining = isRevive ? 15 : 60;
    // Restore header for non-adventure modes
    document.querySelector('.score-board h2').innerHTML = `Puntos: <span id="score">0</span>`;
    uiScore = document.getElementById('score');
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
      const color = currentColorSet[Math.floor(Math.random() * currentColors)];
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

      // Check if the board is completely clear
      if (isBoardClear()) {
        showCelebration();
        return;
      }

      if (!checkPossibleMoves()) {
        // In adventure mode, check if the target was reached
        if (currentMode === 'adventure') {
          const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
          if (score >= config.target && !levelCompleted) {
            handleLevelComplete();
          } else if (!levelCompleted) {
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
        const color = COLORS[Math.floor(Math.random() * currentColors)];
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

function calculatePoints(count) {
  if (count <= 3) return 100;
  if (count === 4) return 250;
  if (count === 5) return 400;
  if (count === 6) return 750;
  return 1000;
}

function updateScore(points) {
  score += points;
  if (currentMode === 'timeattack') {
    uiScore.innerText = `${score} (⏱️${timeRemaining}s)`;
  } else if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    uiScore.innerText = `${score} / ${config.target}`;
    // Auto-advance when target is reached mid-play
    if (points > 0 && score >= config.target && !levelCompleted) {
      levelCompleted = true;
      // Defer to allow current animation cycle to finish
      setTimeout(() => handleLevelComplete(), 500);
    }
  } else {
    uiScore.innerText = score;
  }
}

function updateModeButtons() {
  const zenBtn = document.getElementById('mode-zen-btn');
  const taBtn = document.getElementById('mode-timeattack-btn');

  if (currentLevelIndex >= 49) {
    zenBtn.classList.remove('locked-mode');
    zenBtn.querySelector('small').textContent = '10x10 - Juega sin límite de tiempo';
  } else {
    zenBtn.classList.add('locked-mode');
    zenBtn.querySelector('small').textContent = `🔒 Se desbloquea en el Nivel 50`;
  }

  if (currentLevelIndex >= 29) {
    taBtn.classList.remove('locked-mode');
    taBtn.querySelector('small').textContent = '8x8 - ¡Compite en la clasificación!';
  } else {
    taBtn.classList.add('locked-mode');
    taBtn.querySelector('small').textContent = `🔒 Se desbloquea en el Nivel 30`;
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
      const localVisited = new Set();
      localVisited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        groupSize.push(curr);
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
    title.innerText = "¡Tiempo Terminado!";
  } else {
    title.innerText = "¡Sin movimientos!";
  }

  document.getElementById('final-score').innerText = score;
  if (currentMode === 'adventure' && !timeout) {
    document.getElementById('play-again-btn').innerText = "Reintentar";
    document.getElementById('play-again-btn').dataset.action = 'retry';
  } else {
    document.getElementById('play-again-btn').innerText = "Menú Principal";
    document.getElementById('play-again-btn').dataset.action = 'menu';
  }

  const reviveBtn = document.getElementById('revive-btn');
  if ((currentMode === 'timeattack' || currentMode === 'adventure') && !hasUsedRevive && score > 0) {
    reviveBtn.classList.remove('hidden');
    prepareRewarded(); // pre-load in background
  } else {
    reviveBtn.classList.add('hidden');
  }

  document.getElementById('game-over').classList.remove('hidden');

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
  updateModeButtons();

  const title = document.querySelector('#game-over h2');
  title.innerText = `¡Nivel ${currentLevelIndex} Completado!`;
  document.getElementById('final-score').innerText = score;
  document.getElementById('play-again-btn').innerText = "Siguiente Nivel";
  document.getElementById('play-again-btn').dataset.action = 'next';
  document.getElementById('revive-btn').classList.add('hidden');
  document.getElementById('game-over').classList.remove('hidden');

  // Interstitial every 10 levels starting from level 10
  if (currentLevelIndex >= 10 && currentLevelIndex % 10 === 0) {
    prepareInterstitial().then(() => showInterstitialAd());
  }

  // Mode unlock notifications
  if (currentLevelIndex === 30) {
    setTimeout(() => {
      alert('🎉 ¡Has desbloqueado el Modo Contrarreloj! Compite por la mejor puntuación.');
    }, 500);
  } else if (currentLevelIndex === 50) {
    setTimeout(() => {
      alert('🎉 ¡Has desbloqueado el Modo Zen! Disfruta sin límites.');
    }, 500);
  }
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

// Tutorial system
function showTutorial() {
  const totalSteps = 3;
  let currentStep = 1;

  const screen = document.getElementById('tutorial-screen');
  const btn = document.getElementById('tutorial-next-btn');
  const dotsContainer = document.getElementById('tutorial-dots');

  // Create dots
  dotsContainer.innerHTML = '';
  for (let i = 1; i <= totalSteps; i++) {
    const dot = document.createElement('span');
    dot.className = `tutorial-dot${i === 1 ? ' active' : ''}`;
    dotsContainer.appendChild(dot);
  }

  // Show first step
  document.querySelectorAll('.tutorial-step').forEach(s => s.classList.add('hidden'));
  document.querySelector('.tutorial-step[data-step="1"]').classList.remove('hidden');
  btn.innerText = 'Siguiente';
  screen.classList.remove('hidden');

  // Remove old listeners by cloning
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', () => {
    if (currentStep < totalSteps) {
      // Hide current, show next
      document.querySelector(`.tutorial-step[data-step="${currentStep}"]`).classList.add('hidden');
      currentStep++;
      document.querySelector(`.tutorial-step[data-step="${currentStep}"]`).classList.remove('hidden');

      // Update dots
      dotsContainer.querySelectorAll('.tutorial-dot').forEach((d, i) => {
        d.classList.toggle('active', i + 1 === currentStep);
      });

      // Last step: change button text
      if (currentStep === totalSteps) {
        newBtn.innerText = '¡A Jugar!';
      }
    } else {
      // Tutorial complete
      localStorage.setItem('bolitasTutorialDone', 'true');
      screen.classList.add('hidden');
      startGame(); // Now actually start the game
    }
  });
}
