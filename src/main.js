import './style.css';
import { saveScore, getLeaderboard } from './firebase.js';
import { playSelectSound, playPopSound, playErrorSound, playGameOverSound } from './audio.js';

const COLS = 10;
const ROWS = 12;
const MIN_GROUP = 3;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

let grid = []; // 2D array [row][col], row 0 is top.
let score = 0;
let uiScore;
let uiGrid;
let isAnimating = false;
let selectedGroup = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  uiScore = document.getElementById('score');
  uiGrid = document.getElementById('grid');

  // UI Handlers
  document.getElementById('restart-btn').addEventListener('click', initGame);
  document.getElementById('play-again-btn').addEventListener('click', initGame);
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', logoutUser);
  document.getElementById('show-leaderboard-btn').addEventListener('click', showLeaderboard);
  document.getElementById('close-leaderboard-btn').addEventListener('click', hideLeaderboard);

  checkExistingSession();
});

function checkExistingSession() {
  const savedUser = localStorage.getItem('bolitasUser');
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById('current-username').innerText = currentUser;
    document.getElementById('login-screen').classList.add('hidden');
    initGame();
  } else {
    // Show login screen
    document.getElementById('login-screen').classList.remove('hidden');
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
  document.getElementById('login-screen').classList.add('hidden');
  initGame();
}

function logoutUser() {
  localStorage.removeItem('bolitasUser');
  currentUser = null;
  document.getElementById('login-screen').classList.remove('hidden');
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

function initGame() {
  document.getElementById('game-over').classList.add('hidden');
  uiGrid.innerHTML = '';
  score = 0;
  updateScore(0);
  isAnimating = false;
  selectedGroup = [];

  grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      createBolita(r, c, color);
    }
  }

  // Ensure there's at least one move to start with
  if (!checkPossibleMoves()) {
    initGame(); // Reroll if totally unplayable from the start
  }
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

    // Play Pop Sound
    playPopSound(groupToPop.length);

    groupToPop.forEach(bolita => {
      bolita.el.classList.remove('selected');
      bolita.el.classList.add('popped');
      grid[bolita.r][bolita.c] = null; // remove from logic grid immediately
    });

    // Add Score
    const points = calculatePoints(groupToPop.length);
    updateScore(points);

    // Spawn floating score visually at the clicked bolita
    spawnFloatingScore(points, el);

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

      if (!checkPossibleMoves()) {
        showGameOver();
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
      if (currR < 0 || currR >= ROWS || currC < 0 || currC >= COLS) return;
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
      playSelectSound();
      selectedGroup = group;
      selectedGroup.forEach(b => b.el.classList.add('selected'));
    } else {
      playErrorSound();
    }
  }
}

function spawnFloatingScore(points, targetEl) {
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
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && grid[r][c].el === el) {
        return { r, c };
      }
    }
  }
  return null;
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let emptyRow = ROWS - 1;
    // Scan from bottom to top
    for (let r = ROWS - 1; r >= 0; r--) {
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

  for (let c = 0; c < COLS; c++) {
    // Check if entire column is empty
    let isColEmpty = true;
    for (let r = 0; r < ROWS; r++) {
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
      for (let r = 0; r < ROWS; r++) {
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
  uiScore.innerText = score;
}

function checkPossibleMoves() {
  const visited = new Set();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
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
          if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
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

async function showGameOver() {
  playGameOverSound();
  document.getElementById('final-score').innerText = score;
  document.getElementById('game-over').classList.remove('hidden');

  if (currentUser && score > 0) {
    try {
      await saveScore(currentUser, score);
    } catch (e) {
      console.error("Failed to save score:", e);
    }
  }
}
