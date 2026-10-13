/**
 * economy.js — Coins, XP, Player Level, Daily Quests, Shop
 *
 * All state is persisted in localStorage under `gloop_economy`.
 */
import analyticsManager from './analyticsManager.js';

// ======================== CONSTANTS ========================

// XP needed per player level (cumulative thresholds)
export const XP_PER_LEVEL = 500; // Every 500 XP * level = next level up

// Coins earned per game event
export const COIN_REWARDS = {
  levelComplete: 20,
  boardClear: 20,
  bigPop: 2,       // 10+ bolitas in one pop
  questComplete: 0, // set per quest
};

// Quest swap cost
export const QUEST_SWAP_COST = 50;

// ======================== QUEST TEMPLATES (100) ========================

const QUEST_TEMPLATES = [
  // --- Pop-based (20) ---
  { id: 1, type: 'pop_total', target: 50, desc: 'Pop 50 bolitas', reward: 30, icon: '💥' },
  { id: 2, type: 'pop_total', target: 100, desc: 'Pop 100 bolitas', reward: 50, icon: '💥' },
  { id: 3, type: 'pop_total', target: 200, desc: 'Pop 200 bolitas', reward: 80, icon: '💥' },
  { id: 4, type: 'pop_total', target: 300, desc: 'Pop 300 bolitas', reward: 100, icon: '💥' },
  { id: 5, type: 'pop_total', target: 500, desc: 'Pop 500 bolitas', reward: 150, icon: '💥' },
  { id: 6, type: 'pop_color', color: 'red', target: 30, desc: 'Pop 30 red bolitas', reward: 40, icon: '🔴' },
  { id: 7, type: 'pop_color', color: 'blue', target: 30, desc: 'Pop 30 blue bolitas', reward: 40, icon: '🔵' },
  { id: 8, type: 'pop_color', color: 'green', target: 30, desc: 'Pop 30 green bolitas', reward: 40, icon: '🟢' },
  { id: 9, type: 'pop_color', color: 'yellow', target: 30, desc: 'Pop 30 yellow bolitas', reward: 40, icon: '🟡' },
  { id: 10, type: 'pop_color', color: 'red', target: 60, desc: 'Pop 60 red bolitas', reward: 60, icon: '🔴' },
  { id: 11, type: 'pop_color', color: 'blue', target: 60, desc: 'Pop 60 blue bolitas', reward: 60, icon: '🔵' },
  { id: 12, type: 'pop_color', color: 'green', target: 60, desc: 'Pop 60 green bolitas', reward: 60, icon: '🟢' },
  { id: 13, type: 'pop_color', color: 'cyan', target: 30, desc: 'Pop 30 cyan bolitas', reward: 40, icon: '🩵' },
  { id: 14, type: 'pop_color', color: 'purple', target: 30, desc: 'Pop 30 purple bolitas', reward: 40, icon: '🟣' },
  { id: 15, type: 'pop_color', color: 'pink', target: 30, desc: 'Pop 30 pink bolitas', reward: 40, icon: '🩷' },
  { id: 16, type: 'pop_color', color: 'orange', target: 30, desc: 'Pop 30 orange bolitas', reward: 40, icon: '🟠' },
  { id: 17, type: 'pop_color', color: 'yellow', target: 60, desc: 'Pop 60 yellow bolitas', reward: 60, icon: '🟡' },
  { id: 18, type: 'pop_color', color: 'cyan', target: 60, desc: 'Pop 60 cyan bolitas', reward: 60, icon: '🩵' },
  { id: 19, type: 'pop_color', color: 'purple', target: 60, desc: 'Pop 60 purple bolitas', reward: 60, icon: '🟣' },
  { id: 20, type: 'pop_color', color: 'pink', target: 60, desc: 'Pop 60 pink bolitas', reward: 60, icon: '🩷' },

  // --- Big pop (chain) (10) ---
  { id: 21, type: 'big_pop', target: 1, minSize: 6, desc: 'Pop a group of 6+', reward: 30, icon: '🫧' },
  { id: 22, type: 'big_pop', target: 2, minSize: 6, desc: 'Pop 2 groups of 6+', reward: 50, icon: '🫧' },
  { id: 23, type: 'big_pop', target: 3, minSize: 6, desc: 'Pop 3 groups of 6+', reward: 70, icon: '🫧' },
  { id: 24, type: 'big_pop', target: 5, minSize: 6, desc: 'Pop 5 groups of 6+', reward: 100, icon: '🫧' },
  { id: 25, type: 'big_pop', target: 1, minSize: 8, desc: 'Pop a group of 8+', reward: 50, icon: '🔥' },
  { id: 26, type: 'big_pop', target: 2, minSize: 8, desc: 'Pop 2 groups of 8+', reward: 80, icon: '🔥' },
  { id: 27, type: 'big_pop', target: 1, minSize: 10, desc: 'Pop a group of 10+', reward: 80, icon: '🔥' },
  { id: 28, type: 'big_pop', target: 2, minSize: 10, desc: 'Pop 2 groups of 10+', reward: 120, icon: '🔥' },
  { id: 29, type: 'big_pop', target: 1, minSize: 12, desc: 'Pop a group of 12+', reward: 100, icon: '💎' },
  { id: 30, type: 'big_pop', target: 3, minSize: 10, desc: 'Pop 3 groups of 10+', reward: 150, icon: '💎' },

  // --- Level completion (20) ---
  { id: 31, type: 'complete_levels', target: 1, desc: 'Complete 1 level', reward: 30, icon: '⭐' },
  { id: 32, type: 'complete_levels', target: 2, desc: 'Complete 2 levels', reward: 50, icon: '⭐' },
  { id: 33, type: 'complete_levels', target: 3, desc: 'Complete 3 levels', reward: 70, icon: '⭐' },
  { id: 34, type: 'complete_levels', target: 5, desc: 'Complete 5 levels', reward: 100, icon: '⭐' },
  { id: 35, type: 'complete_levels', target: 7, desc: 'Complete 7 levels', reward: 130, icon: '🌟' },
  { id: 36, type: 'complete_levels', target: 10, desc: 'Complete 10 levels', reward: 200, icon: '🌟' },
  { id: 37, type: 'clear_board', target: 1, desc: 'Clear the entire board', reward: 80, icon: '✨' },
  { id: 38, type: 'clear_board', target: 2, desc: 'Clear 2 boards', reward: 120, icon: '✨' },
  { id: 39, type: 'clear_board', target: 3, desc: 'Clear 3 boards', reward: 150, icon: '✨' },
  { id: 40, type: 'clear_board', target: 5, desc: 'Clear 5 boards', reward: 200, icon: '✨' },
  { id: 41, type: 'complete_levels', target: 4, desc: 'Complete 4 levels', reward: 80, icon: '⭐' },
  { id: 42, type: 'complete_levels', target: 6, desc: 'Complete 6 levels', reward: 110, icon: '⭐' },
  { id: 43, type: 'complete_levels', target: 8, desc: 'Complete 8 levels', reward: 150, icon: '🌟' },
  { id: 44, type: 'complete_levels', target: 12, desc: 'Complete 12 levels', reward: 250, icon: '🌟' },
  { id: 45, type: 'complete_levels', target: 15, desc: 'Complete 15 levels', reward: 300, icon: '🏆' },
  { id: 46, type: 'clear_board', target: 4, desc: 'Clear 4 boards', reward: 180, icon: '✨' },
  { id: 47, type: 'score_total', target: 1000, desc: 'Score 1,000 points', reward: 30, icon: '🎯' },
  { id: 48, type: 'score_total', target: 3000, desc: 'Score 3,000 points', reward: 60, icon: '🎯' },
  { id: 49, type: 'score_total', target: 5000, desc: 'Score 5,000 points', reward: 90, icon: '🎯' },
  { id: 50, type: 'score_total', target: 10000, desc: 'Score 10,000 points', reward: 150, icon: '🎯' },

  // --- Score goals in a single game (10) ---
  { id: 51, type: 'score_single', target: 500, desc: 'Score 500 in one game', reward: 30, icon: '🏅' },
  { id: 52, type: 'score_single', target: 1000, desc: 'Score 1,000 in one game', reward: 50, icon: '🏅' },
  { id: 53, type: 'score_single', target: 2000, desc: 'Score 2,000 in one game', reward: 80, icon: '🏅' },
  { id: 54, type: 'score_single', target: 3000, desc: 'Score 3,000 in one game', reward: 100, icon: '🏅' },
  { id: 55, type: 'score_single', target: 5000, desc: 'Score 5,000 in one game', reward: 150, icon: '🏅' },
  { id: 56, type: 'score_single', target: 7000, desc: 'Score 7,000 in one game', reward: 200, icon: '🏅' },
  { id: 57, type: 'score_single', target: 10000, desc: 'Score 10,000 in one game', reward: 300, icon: '🏅' },
  { id: 58, type: 'score_single', target: 800, desc: 'Score 800 in one game', reward: 40, icon: '🏅' },
  { id: 59, type: 'score_single', target: 1500, desc: 'Score 1,500 in one game', reward: 60, icon: '🏅' },
  { id: 60, type: 'score_single', target: 4000, desc: 'Score 4,000 in one game', reward: 120, icon: '🏅' },

  // --- Play sessions (10) ---
  { id: 61, type: 'play_games', target: 2, desc: 'Play 2 games', reward: 20, icon: '🎮' },
  { id: 62, type: 'play_games', target: 3, desc: 'Play 3 games', reward: 30, icon: '🎮' },
  { id: 63, type: 'play_games', target: 5, desc: 'Play 5 games', reward: 50, icon: '🎮' },
  { id: 64, type: 'play_games', target: 7, desc: 'Play 7 games', reward: 70, icon: '🎮' },
  { id: 65, type: 'play_games', target: 10, desc: 'Play 10 games', reward: 100, icon: '🎮' },
  { id: 66, type: 'play_games', target: 4, desc: 'Play 4 games', reward: 40, icon: '🎮' },
  { id: 67, type: 'play_games', target: 6, desc: 'Play 6 games', reward: 60, icon: '🎮' },
  { id: 68, type: 'play_games', target: 8, desc: 'Play 8 games', reward: 80, icon: '🎮' },
  { id: 69, type: 'play_games', target: 12, desc: 'Play 12 games', reward: 120, icon: '🎮' },
  { id: 70, type: 'play_games', target: 15, desc: 'Play 15 games', reward: 150, icon: '🎮' },

  // --- Mode-specific (15) ---
  { id: 71, type: 'play_mode', mode: 'adventure', target: 2, desc: 'Play 2 Career levels', reward: 30, icon: '🗺️' },
  { id: 72, type: 'play_mode', mode: 'adventure', target: 4, desc: 'Play 4 Career levels', reward: 60, icon: '🗺️' },
  { id: 73, type: 'play_mode', mode: 'adventure', target: 6, desc: 'Play 6 Career levels', reward: 100, icon: '🗺️' },
  { id: 74, type: 'complete_levels', target: 2, desc: 'Complete 2 Career levels', reward: 30, icon: '⭐' },
  { id: 75, type: 'complete_levels', target: 4, desc: 'Complete 4 Career levels', reward: 60, icon: '⭐' },
  { id: 76, type: 'complete_levels', target: 6, desc: 'Complete 6 Career levels', reward: 100, icon: '⭐' },
  { id: 77, type: 'play_mode', mode: 'adventure', target: 3, desc: 'Play 3 Career levels', reward: 40, icon: '🗺️' },
  { id: 78, type: 'play_mode', mode: 'adventure', target: 5, desc: 'Play 5 Career levels', reward: 70, icon: '🗺️' },
  { id: 79, type: 'play_mode', mode: 'adventure', target: 10, desc: 'Play 10 Career levels', reward: 130, icon: '🗺️' },
  { id: 80, type: 'score_single', target: 2500, desc: 'Score 2,500 in one game', reward: 80, icon: '🏅' },
  { id: 81, type: 'score_single', target: 4500, desc: 'Score 4,500 in one game', reward: 120, icon: '🏅' },
  { id: 82, type: 'score_single', target: 6000, desc: 'Score 6,000 in one game', reward: 150, icon: '🏅' },
  { id: 83, type: 'pop_total', target: 250, desc: 'Pop 250 bolitas', reward: 80, icon: '💥' },
  { id: 84, type: 'pop_total', target: 450, desc: 'Pop 450 bolitas', reward: 140, icon: '💥' },
  { id: 85, type: 'pop_total', target: 600, desc: 'Pop 600 bolitas', reward: 180, icon: '💥' },

  // --- Miscellaneous (15) ---
  { id: 86, type: 'pop_total', target: 80, desc: 'Pop 80 bolitas', reward: 40, icon: '💥' },
  { id: 87, type: 'pop_total', target: 150, desc: 'Pop 150 bolitas', reward: 60, icon: '💥' },
  { id: 88, type: 'pop_total', target: 400, desc: 'Pop 400 bolitas', reward: 120, icon: '💥' },
  { id: 89, type: 'big_pop', target: 4, minSize: 6, desc: 'Pop 4 groups of 6+', reward: 90, icon: '🫧' },
  { id: 90, type: 'big_pop', target: 3, minSize: 8, desc: 'Pop 3 groups of 8+', reward: 100, icon: '🔥' },
  { id: 91, type: 'score_total', target: 2000, desc: 'Score 2,000 points', reward: 40, icon: '🎯' },
  { id: 92, type: 'score_total', target: 7000, desc: 'Score 7,000 points', reward: 110, icon: '🎯' },
  { id: 93, type: 'score_total', target: 15000, desc: 'Score 15,000 points', reward: 200, icon: '🎯' },
  { id: 94, type: 'complete_levels', target: 9, desc: 'Complete 9 levels', reward: 160, icon: '🌟' },
  { id: 95, type: 'complete_levels', target: 20, desc: 'Complete 20 levels', reward: 400, icon: '🏆' },
  { id: 96, type: 'pop_color', color: 'orange', target: 60, desc: 'Pop 60 orange bolitas', reward: 60, icon: '🟠' },
  { id: 97, type: 'pop_total', target: 700, desc: 'Pop 700 bolitas', reward: 180, icon: '💥' },
  { id: 98, type: 'pop_total', target: 1000, desc: 'Pop 1,000 bolitas', reward: 250, icon: '💥' },
  { id: 99, type: 'play_games', target: 20, desc: 'Play 20 games', reward: 200, icon: '🎮' },
  { id: 100, type: 'big_pop', target: 5, minSize: 8, desc: 'Pop 5 groups of 8+', reward: 150, icon: '🔥' },
];

// ======================== WEEKLY QUEST TEMPLATES ========================

const WEEKLY_QUEST_TEMPLATES = [
  { id: 'w1', type: 'pop_total', target: 5000, desc: 'Pop 5,000 bolitas', reward: 500, icon: '💥' },
  { id: 'w2', type: 'pop_total', target: 10000, desc: 'Pop 10,000 bolitas', reward: 1000, icon: '💥' },
  { id: 'w3', type: 'complete_levels', target: 20, desc: 'Complete 20 levels', reward: 600, icon: '⭐' },
  { id: 'w4', type: 'complete_levels', target: 40, desc: 'Complete 40 levels', reward: 1200, icon: '🏆' },
  { id: 'w5', type: 'clear_board', target: 10, desc: 'Clear 10 boards', reward: 800, icon: '✨' },
  { id: 'w6', type: 'clear_board', target: 20, desc: 'Clear 20 boards', reward: 1500, icon: '✨' },
  { id: 'w7', type: 'score_total', target: 50000, desc: 'Score 50,000 points', reward: 700, icon: '🎯' },
  { id: 'w8', type: 'score_total', target: 100000, desc: 'Score 100,000 points', reward: 1500, icon: '🎯' },
  { id: 'w9', type: 'big_pop', target: 20, minSize: 6, desc: 'Pop 20 groups of 6+', reward: 500, icon: '🫧' },
  { id: 'w10', type: 'big_pop', target: 10, minSize: 10, desc: 'Pop 10 groups of 10+', reward: 800, icon: '🔥' },
  { id: 'w11', type: 'play_games', target: 30, desc: 'Play 30 games', reward: 600, icon: '🎮' },
  { id: 'w12', type: 'play_games', target: 50, desc: 'Play 50 games', reward: 1000, icon: '🎮' },
  { id: 'w13', type: 'play_mode', mode: 'adventure', target: 20, desc: 'Play 20 Career levels', reward: 500, icon: '🗺️' },
  { id: 'w14', type: 'complete_levels', target: 25, desc: 'Complete 25 Career levels', reward: 600, icon: '⭐' },
  { id: 'w15', type: 'score_single', target: 10000, desc: 'Score 10,000 in one game', reward: 800, icon: '🏅' },
  { id: 'w16', type: 'score_single', target: 15000, desc: 'Score 15,000 in one game', reward: 1000, icon: '🏅' },
  { id: 'w17', type: 'pop_color', color: 'red', target: 500, desc: 'Pop 500 red bolitas', reward: 400, icon: '🔴' },
  { id: 'w18', type: 'pop_color', color: 'blue', target: 500, desc: 'Pop 500 blue bolitas', reward: 400, icon: '🔵' },
  { id: 'w19', type: 'score_single', target: 5000, desc: 'Score 5,000 in one game', reward: 600, icon: '🏅' },
  { id: 'w20', type: 'big_pop', target: 30, minSize: 8, desc: 'Pop 30 groups of 8+', reward: 1200, icon: '🔥' },
];

// ======================== SHOP DATA ========================




export const SHOP_BOOSTERS = [
  { id: 'sniper',      name: 'Sniper',         desc: 'Removes one specific bolita',     price: 100,  icon: '🎯', quantity: 1, unlockLevel: 6 },
  { id: 'shuffle',     name: 'Shuffle',        desc: 'Shuffle the board once',          price: 150,  icon: '🔀', quantity: 1, unlockLevel: 10 },
  { id: 'magic_brush', name: 'Magic Brush',    desc: 'Changes the color of one bolita', price: 250,  icon: '🖌️', quantity: 1, unlockLevel: 16 },
  { id: 'bomb',        name: 'Bomb',           desc: 'Destroys a 3x3 area',             price: 350,  icon: '💣', quantity: 1, unlockLevel: 21 },
  { id: 'color_bomb',  name: 'Color Bomb',     desc: 'Removes all of one color',        price: 500,  icon: '🌈', quantity: 1, unlockLevel: 26 },
];

// ======================== STATE MANAGEMENT ========================

const STORAGE_KEY = 'gloop_economy';

function getDefaultStats() {
  return {
    popsTotal: 0,
    popsByColor: {},
    bigPops: [],     // array of sizes
    levelsCompleted: 0,
    boardsCleared: 0,
    scoreTotal: 0,
    scoreSingle: 0,  // max single-game score
    gamesPlayed: 0,
    gamesPlayedByMode: {},
    scoreByMode: {},
  };
}

function getDefaultState() {
  return {
    coins: 0,
    xp: 0,
    playerLevel: 1,
    ownedBoosters: {}, // { booster_id: count }
    // Daily quests
    dailyQuests: [],   // array of { questId, progress, claimed }
    lastDailyReset: 0, // Timestamp
    // Weekly quests
    weeklyQuests: [],
    lastWeeklyReset: 0, // Timestamp
    // Session tracking for daily quests
    sessionStats: getDefaultStats(),
    // Weekly tracking (persists across the week)
    weeklyStats: getDefaultStats(),
  };
}

let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...getDefaultState(), ...parsed };
      // Ensure nested objects are fully populated (deep merge basic fields)
      state.sessionStats = { ...getDefaultStats(), ...(parsed.sessionStats || {}) };
      state.weeklyStats = { ...getDefaultStats(), ...(parsed.weeklyStats || {}) };
      if (!state.weeklyQuests) state.weeklyQuests = [];
      if (!state.ownedBoosters) state.ownedBoosters = {};
    } else {
      state = getDefaultState();
    }
  } catch {
    state = getDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Initialize on import
loadState();

// ======================== COINS ========================

export function getCoins() { return state.coins; }

export function addCoins(amount) {
  state.coins += amount;
  saveState();
  analyticsManager.setUserProperty('total_coins', state.coins);
  return state.coins;
}

export function spendCoins(amount) {
  if (state.coins < amount) return false;
  state.coins -= amount;
  saveState();
  return true;
}

// ======================== XP & PLAYER LEVEL ========================

export function getXP() { return state.xp; }
export function getPlayerLevel() { return state.playerLevel; }

export function getXPForNextLevel() {
  return state.playerLevel * XP_PER_LEVEL;
}

export function getXPProgress() {
  const needed = getXPForNextLevel();
  const current = state.xp;
  return Math.min(current / needed, 1);
}

export function getXPToNextReward() {
  const playerLvl = getPlayerLevel();
  const nextRewardLvl = playerLvl + (5 - (playerLvl % 5));
  if (nextRewardLvl === playerLvl) return 0; // Already at milestone

  // XP to finish current level
  let totalXPNeeded = getXPForNextLevel() - state.xp;
  
  // XP for each level in between
  for (let l = playerLvl + 1; l < nextRewardLvl; l++) {
    totalXPNeeded += l * XP_PER_LEVEL;
  }
  return totalXPNeeded;
}

/**
 * Add XP and handle level-ups.
 * Returns { newXP, newLevel, leveledUp }
 */
export function addXP(amount) {
  state.xp += amount;
  let leveledUp = false;

  while (state.xp >= getXPForNextLevel()) {
    state.xp -= getXPForNextLevel();
    state.playerLevel++;
    leveledUp = true;
  }

  saveState();
  analyticsManager.setUserProperty('player_level', state.playerLevel);
  return { newXP: state.xp, newLevel: state.playerLevel, leveledUp };
}

// ======================== DAILY QUESTS ========================


function getLatest9AM(now) {
  const d = new Date(now);
  d.setHours(9, 0, 0, 0); // 9:00:00.000
  if (d.getTime() > now.getTime()) {
    // If it's before 9am today, the "latest 9am" was yesterday
    d.setDate(d.getDate() - 1);
  }
  return d.getTime();
}

function pickRandomQuests(count) {
  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(q => ({
    questId: q.id,
    progress: 0,
    claimed: false,
  }));
}

function getLatestMonday9AM(now) {
  const d = new Date(now);
  // Monday is 1 (Sun is 0, Sat is 6)
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since last Monday
  d.setDate(d.getDate() - diff);
  d.setHours(9, 0, 0, 0);
  
  if (d.getTime() > now.getTime()) {
    // If it's before 9am this Monday, the "latest" was last Monday
    d.setDate(d.getDate() - 7);
  }
  return d.getTime();
}


function pickRandomWeeklyQuests(count) {
  const shuffled = [...WEEKLY_QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(q => ({
    questId: q.id,
    progress: 0,
    claimed: false,
  }));
}

/**
 * Saved questIds can go stale if the template list changes between app versions;
 * enriching a quest whose template no longer exists would crash on `template.target`.
 * Replaces any orphaned quest with a fresh random one.
 */
function repairOrphanQuests(questList, templates) {
  let repaired = false;
  const currentIds = new Set(questList.map(q => q.questId));
  questList.forEach((q, i) => {
    if (templates.some(t => t.id === q.questId)) return;
    const available = templates.filter(t => !currentIds.has(t.id));
    const replacement = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : templates[0];
    questList[i] = { questId: replacement.id, progress: 0, claimed: false };
    currentIds.add(replacement.id);
    repaired = true;
  });
  if (repaired) saveState();
}

/**
 * Get today's 5 daily quests. Resets at 9 AM local time.
 */
export function getDailyQuests() {
  const now = new Date();
  const latest9AM = getLatest9AM(now);

  if (state.lastDailyReset < latest9AM) {
    state.dailyQuests = pickRandomQuests(5);
    state.lastDailyReset = latest9AM;
    state.sessionStats = getDefaultStats();
    saveState();
  }

  repairOrphanQuests(state.dailyQuests, QUEST_TEMPLATES);
  updateQuestProgress(); // Ensure progress is fresh before returning

  // Return enriched quest objects
  return state.dailyQuests.map(dq => {
    const template = QUEST_TEMPLATES.find(t => t.id === dq.questId);
    return {
      ...template,
      progress: dq.progress,
      claimed: dq.claimed,
      isComplete: dq.progress >= template.target,
    };
  });
}

/**
 * Swap a quest at a given index for a new random one. Costs coins.
 */
export function swapQuest(index) {
  // Free swap via admob
  const currentIds = new Set(state.dailyQuests.map(q => q.questId));
  const available = QUEST_TEMPLATES.filter(t => !currentIds.has(t.id));
  if (available.length === 0) return false;

  const newQuest = available[Math.floor(Math.random() * available.length)];
  state.dailyQuests[index] = {
    questId: newQuest.id,
    progress: 0,
    claimed: false,
  };
  saveState();
  return true;
}

// ======================== WEEKLY QUESTS ========================

/**
 * Get this week's 3 weekly quests. Resets every Monday at 9 AM.
 */
export function getWeeklyQuests() {
  const now = new Date();
  const latestMonday9AM = getLatestMonday9AM(now);

  if (state.lastWeeklyReset < latestMonday9AM) {
    state.weeklyQuests = pickRandomWeeklyQuests(3);
    state.lastWeeklyReset = latestMonday9AM;
    state.weeklyStats = getDefaultStats();
    saveState();
  }

  repairOrphanQuests(state.weeklyQuests, WEEKLY_QUEST_TEMPLATES);
  updateQuestProgress(); // Ensure progress is fresh before returning

  return state.weeklyQuests.map(wq => {
    const template = WEEKLY_QUEST_TEMPLATES.find(t => t.id === wq.questId);
    return {
      ...template,
      progress: wq.progress,
      claimed: wq.claimed,
      isComplete: wq.progress >= template.target,
    };
  });
}

export function getNextDailyReset() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function getNextWeeklyReset() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7; // days until next Monday
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  // Ensure it's in the future
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 7);
  }
  return d.getTime();
}

export function claimWeeklyQuest(index) {
  const wq = state.weeklyQuests[index];
  const template = WEEKLY_QUEST_TEMPLATES.find(t => t.id === wq.questId);
  if (!template || wq.claimed || wq.progress < template.target) return 0;

  wq.claimed = true;
  addCoins(template.reward);
  saveState();

  // Log daily feature used event for weekly missions
  analyticsManager.logCustomEvent(analyticsManager.Events.DAILY_FEATURE_USED, {
    [analyticsManager.Params.FEATURE_NAME]: 'weekly_mission'
  });

  return template.reward;
}

export function hasClaimableDailyQuests() {
  return state.dailyQuests.some(dq => {
    const t = QUEST_TEMPLATES.find(qt => qt.id === dq.questId);
    return t && !dq.claimed && dq.progress >= t.target;
  });
}

export function hasClaimableWeeklyQuests() {
  return state.weeklyQuests.some(wq => {
    const t = WEEKLY_QUEST_TEMPLATES.find(qt => qt.id === wq.questId);
    return t && !wq.claimed && wq.progress >= t.target;
  });
}

export function hasClaimableQuests() {
  return hasClaimableDailyQuests() || hasClaimableWeeklyQuests();
}

export function swapWeeklyQuest(index) {
  const currentIds = new Set(state.weeklyQuests.map(q => q.questId));
  const available = WEEKLY_QUEST_TEMPLATES.filter(t => !currentIds.has(t.id));
  if (available.length === 0) return false;

  const newQuest = available[Math.floor(Math.random() * available.length)];
  state.weeklyQuests[index] = {
    questId: newQuest.id,
    progress: 0,
    claimed: false,
  };
  saveState();
  return true;
}

/**
 * Claim a completed quest reward.
 */
export function claimQuest(index) {
  const dq = state.dailyQuests[index];
  const template = QUEST_TEMPLATES.find(t => t.id === dq.questId);
  if (!template || dq.claimed || dq.progress < template.target) return 0;

  dq.claimed = true;
  addCoins(template.reward);
  saveState();

  // Log daily feature used event for daily missions
  analyticsManager.logCustomEvent(analyticsManager.Events.DAILY_FEATURE_USED, {
    [analyticsManager.Params.FEATURE_NAME]: 'daily_mission'
  });

  return template.reward;
}

// ======================== QUEST PROGRESS TRACKING ========================

/**
 * Called after each pop event. Updates all relevant quest progress.
 */
export function trackPop(color, groupSize) {
  // Daily
  const stats = state.sessionStats;
  stats.popsTotal += groupSize;
  stats.popsByColor[color] = (stats.popsByColor[color] || 0) + groupSize;
  if (groupSize >= 6) stats.bigPops.push(groupSize);

  // Weekly
  const ws = state.weeklyStats;
  ws.popsTotal += groupSize;
  ws.popsByColor[color] = (ws.popsByColor[color] || 0) + groupSize;
  if (groupSize >= 6) ws.bigPops.push(groupSize);

  updateQuestProgress();
  saveState();
}

export function trackLevelComplete() {
  state.sessionStats.levelsCompleted++;
  state.weeklyStats.levelsCompleted++;
  updateQuestProgress();
  saveState();
}

export function trackBoardClear() {
  state.sessionStats.boardsCleared++;
  state.weeklyStats.boardsCleared++;
  updateQuestProgress();
  saveState();
}

export function trackScore(points) {
  state.sessionStats.scoreTotal += points;
  state.weeklyStats.scoreTotal += points;
  updateQuestProgress();
  saveState();
}

export function trackSingleGameScore(score) {
  if (score > state.sessionStats.scoreSingle) state.sessionStats.scoreSingle = score;
  if (score > state.weeklyStats.scoreSingle) state.weeklyStats.scoreSingle = score;
  updateQuestProgress();
  saveState();
}

export function trackGamePlayed(mode) {
  state.sessionStats.gamesPlayed++;
  state.sessionStats.gamesPlayedByMode[mode] = (state.sessionStats.gamesPlayedByMode[mode] || 0) + 1;
  state.weeklyStats.gamesPlayed++;
  state.weeklyStats.gamesPlayedByMode[mode] = (state.weeklyStats.gamesPlayedByMode[mode] || 0) + 1;
  updateQuestProgress();
  saveState();
}

export function trackModeScore(mode, score) {
  state.sessionStats.scoreByMode[mode] = (state.sessionStats.scoreByMode[mode] || 0) + score;
  state.weeklyStats.scoreByMode[mode] = (state.weeklyStats.scoreByMode[mode] || 0) + score;
  updateQuestProgress();
  saveState();
}

function calcProgress(stats, t) {
  switch (t.type) {
    case 'pop_total': return stats.popsTotal;
    case 'pop_color': return stats.popsByColor[t.color] || 0;
    case 'big_pop': return stats.bigPops.filter(s => s >= t.minSize).length;
    case 'complete_levels': return stats.levelsCompleted;
    case 'clear_board': return stats.boardsCleared;
    case 'score_total': return stats.scoreTotal;
    case 'score_single': return stats.scoreSingle;
    case 'play_games': return stats.gamesPlayed;
    case 'play_mode': return stats.gamesPlayedByMode[t.mode] || 0;
    case 'score_mode': return stats.scoreByMode[t.mode] || 0;
    default: return 0;
  }
}

function updateQuestProgress() {
  // Update daily quests
  const dailyStats = state.sessionStats;
  for (const dq of state.dailyQuests) {
    const t = QUEST_TEMPLATES.find(q => q.id === dq.questId);
    if (!t || dq.claimed) continue;
    dq.progress = Math.min(calcProgress(dailyStats, t), t.target);
  }

  // Update weekly quests
  const weeklyStats = state.weeklyStats;
  for (const wq of state.weeklyQuests) {
    const t = WEEKLY_QUEST_TEMPLATES.find(q => q.id === wq.questId);
    if (!t || wq.claimed) continue;
    wq.progress = Math.min(calcProgress(weeklyStats, t), t.target);
  }
}

// ======================== SHOP ========================

export function getBoosterCount(boosterId) {
  return state.ownedBoosters[boosterId] || 0;
}

export function buyBooster(boosterId) {
  const booster = SHOP_BOOSTERS.find(b => b.id === boosterId);
  if (!booster) return false;
  if (booster.unlockLevel) {
    const levelsCompleted = parseInt(localStorage.getItem('bolitasLevel')) || 0;
    if (levelsCompleted + 1 < booster.unlockLevel) return false;
  }
  if (!spendCoins(booster.price)) return false;

  // Log economy sink event
  analyticsManager.logCustomEvent(analyticsManager.Events.ECONOMY_SINK, {
    [analyticsManager.Params.ITEM_BOUGHT]: boosterId,
    [analyticsManager.Params.COST]: booster.price,
    [analyticsManager.Params.CURRENCY]: 'monedas'
  });

  state.ownedBoosters[boosterId] = (state.ownedBoosters[boosterId] || 0) + booster.quantity;
  saveState();
  return true;
}

export function useBooster(boosterId) {
  if ((state.ownedBoosters[boosterId] || 0) <= 0) return false;
  state.ownedBoosters[boosterId]--;
  saveState();
  return true;
}

export function addBoosterFree(boosterId, qty = 1) {
  state.ownedBoosters[boosterId] = (state.ownedBoosters[boosterId] || 0) + qty;
  saveState();
}
