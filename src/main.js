import './style.css';
import { saveScore, getLeaderboard } from './firebase.js';
import { playSelectSound, playPopSound, playErrorSound, playGameOverSound } from './audio.js';

const bgmAudio = new Audio('./assets/bgm.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0.4;

const COLS = 10;
const ROWS = 12;
const MIN_GROUP = 3;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

const LEVELS = [
  { target: 200, rows: 5, cols: 5, colors: 3 }, // Nivel 1 Tutorial
  { target: 500, rows: 7, cols: 7, colors: 4 }, // Nivel 2
  { target: 1000, rows: 10, cols: 10, colors: 4 }, // Nivel 3
  { target: 1500, rows: 12, cols: 10, colors: 5 }, // Nivel 4
  { target: 2500, rows: 15, cols: 12, colors: 6 }, // Nivel 5
  { target: 4000, rows: 20, cols: 15, colors: 7 }, // Nivel 6+
];

let currentMode = 'adventure'; // 'adventure', 'zen', 'timeattack'
let currentLevelIndex = 0;
let timeRemaining = 0;
let timerInterval = null;
let currentRows = 10;
let currentCols = 10;
let currentColors = 5;

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

document.addEventListener('DOMContentLoaded', () => {
  uiScore = document.getElementById('score');
  uiGrid = document.getElementById('grid');

  // UI Handlers
  document.getElementById('restart-btn').addEventListener('click', initGame);
  document.getElementById('play-again-btn').addEventListener('click', returnToMainMenu);
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', logoutUser);
  document.getElementById('show-leaderboard-btn').addEventListener('click', showLeaderboard);
  document.getElementById('close-leaderboard-btn').addEventListener('click', hideLeaderboard);

  // Settings Handlers
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.remove('hidden');
  });
  document.getElementById('close-settings-btn').addEventListener('click', () => {
    document.getElementById('settings-screen').classList.add('hidden');
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
    currentMode = 'zen';
    startGame();
  });
  document.getElementById('mode-timeattack-btn').addEventListener('click', () => {
    currentMode = 'timeattack';
    startGame();
  });

  checkExistingSession();
});

function checkExistingSession() {
  const savedUser = localStorage.getItem('bolitasUser');
  currentLevelIndex = parseInt(localStorage.getItem('bolitasLevel')) || 0;
  document.getElementById('current-level-display').innerText = currentLevelIndex + 1;

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
  clearInterval(timerInterval);
  bgmAudio.pause();
}

function startGame() {
  document.getElementById('login-screen').classList.add('hidden');
  if (isAudioEnabled) {
    bgmAudio.play().catch(e => console.log('Autoplay prevented'));
  }
  initGame();
}

function initGame() {
  document.getElementById('game-over').classList.add('hidden');
  uiGrid.innerHTML = '';
  score = 0;
  updateScore(0);
  isAnimating = false;
  selectedGroup = [];
  comboMultiplier = 1;
  clearInterval(timerInterval);

  // Configure grid based on mode
  if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    currentRows = config.rows;
    currentCols = config.cols;
    currentColors = config.colors;
  } else if (currentMode === 'zen') {
    currentRows = 15;
    currentCols = 15;
    currentColors = 5;
  } else if (currentMode === 'timeattack') {
    currentRows = 20;
    currentCols = 20;
    currentColors = 6; // To keep it challenging but not impossible
    timeRemaining = 60; // 60 seconds
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
      const color = COLORS[Math.floor(Math.random() * currentColors)];
      createBolita(r, c, color);
    }
  }

  // Ensure there's at least one move to start with
  if (!checkPossibleMoves()) {
    initGame(); // Reroll if totally unplayable from the start
  }
}

function startTimer() {
  updateScore(0); // This will update the header to show time as well if needed
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateScore(0); // Trigger visual update
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

  grid[r][c] = {
    color,
    el,
    r,
    c
  };
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

    // Pop animation
    const groupToPop = [...selectedGroup];
    selectedGroup = []; // clear selection
    const currentTime = Date.now();

    // Check Combo
    if (currentTime - lastPopTime < 2000) {
      comboMultiplier++;
    } else {
      comboMultiplier = 1;
    }
    lastPopTime = currentTime;

    // Reset combo timeout
    clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => {
      comboMultiplier = 1;
    }, 2000);

    // Play Pop Sound
    if (isAudioEnabled) playPopSound(groupToPop.length);

    groupToPop.forEach(bolita => {
      bolita.el.classList.remove('selected');
      bolita.el.classList.add('popped');
      grid[bolita.r][bolita.c] = null; // remove from logic grid immediately
    });

    // Add Score
    let points = calculatePoints(groupToPop.length);
    points = Math.floor(points * comboMultiplier);
    updateScore(points);

    // Spawn floating score visually at the clicked bolita
    spawnFloatingScore(points, comboMultiplier, el);

    // Wait for popping animation to start before moving others
    await new Promise(res => setTimeout(res, 200));

    applyGravity();
    applyHorizontalShift();

    // Clean up DOM elements
    setTimeout(() => {
      groupToPop.forEach(bolita => {
        if (bolita.el.parentNode) bolita.el.parentNode.removeChild(bolita.el);
      });
      isAnimating = false;

      // Check level progression before checking for game over moves
      if (currentMode === 'adventure') {
        const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
        if (score >= config.target) {
          handleLevelComplete();
          return;
        }
      }

      if (!checkPossibleMoves()) {
        showGameOver(false);
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
  }
}

function spawnFloatingScore(points, combo, targetEl) {
  const floater = document.createElement('div');
  floater.className = 'floating-score';

  if (combo > 1) {
    floater.innerHTML = `+${points}<br/><span style="font-size: 0.8em; color: var(--clr-red)">Combos x${combo}!</span>`;
    // Add combo class for juicier animation
    floater.classList.add('combo-text');
    floater.classList.remove('floating-score');
  } else {
    floater.innerText = `+${points}`;
  }

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
  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (grid[r][c] && grid[r][c].el === el) {
        return { r, c };
      }
    }
  }
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

function calculatePoints(count) {
  // Classic formula: (count - 2)^2 * 10 or similar
  return Math.pow(count - MIN_GROUP + 1, 2) * 10;
}

function updateScore(points) {
  score += points;
  if (currentMode === 'timeattack') {
    uiScore.innerText = `${score} (⏱️${timeRemaining}s)`;
  } else if (currentMode === 'adventure') {
    const config = LEVELS[Math.min(currentLevelIndex, LEVELS.length - 1)];
    uiScore.innerText = `${score} / ${config.target}`;
  } else {
    uiScore.innerText = score;
  }
}

function checkPossibleMoves() {
  const visited = new Set();

  for (let r = 0; r < currentRows; r++) {
    for (let c = 0; c < currentCols; c++) {
      if (!grid[r][c]) continue;

      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      const targetColor = grid[r][c].color;
      let count = 0;

      // local dfs to count component size
      const queue = [{ r, c }];
      const localVisited = new Set();
      localVisited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        count++;
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

      if (count >= MIN_GROUP) {
        return true; // Found at least one valid move
      }
    }
  }

  return false; // No moves left
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
  document.getElementById('play-again-btn').innerText = "Menu Principal";
  document.getElementById('game-over').classList.remove('hidden');

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

  const title = document.querySelector('#game-over h2');
  title.innerText = `¡Nivel Completado!`;
  document.getElementById('final-score').innerText = score;
  document.getElementById('play-again-btn').innerText = "Siguiente Nivel";
  document.getElementById('game-over').classList.remove('hidden');
}
