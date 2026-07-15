/**
 * livesManager.js — Lives system for Bolitas
 *
 * Players start with MAX_LIVES lives.
 * One life is consumed on adventure mode level loss.
 * Lives restore automatically at 1 per RESTORE_MS.
 */

const MAX_LIVES = 5;
const RESTORE_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const STORAGE_KEY = 'bolitas_lives';

let _lives = MAX_LIVES;
let _lastUpdate = null; // ms timestamp when restoration timer started

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      _lives = typeof d.lives === 'number' ? d.lives : MAX_LIVES;
      _lastUpdate = typeof d.lastUpdate === 'number' ? d.lastUpdate : null;
    }
  } catch { /* use defaults */ }
}

function _save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ lives: _lives, lastUpdate: _lastUpdate }));
}

_load();

/**
 * Restores any lives that should have been gained since the last check.
 * Call on startup and periodically (e.g., every second).
 */
export function checkAndRefill() {
  if (_lives >= MAX_LIVES) {
    if (_lastUpdate !== null) { _lastUpdate = null; _save(); }
    return;
  }
  if (!_lastUpdate) return;

  const elapsed = Date.now() - _lastUpdate;
  const restored = Math.floor(elapsed / RESTORE_MS);
  if (restored <= 0) return;

  _lives = Math.min(MAX_LIVES, _lives + restored);
  _lastUpdate = _lives >= MAX_LIVES ? null : _lastUpdate + restored * RESTORE_MS;
  _save();
}

/** Returns current lives (after checking for any pending restorations). */
export function getLives() {
  checkAndRefill();
  return _lives;
}

export function getMaxLives() { return MAX_LIVES; }

/**
 * Consume one life.
 * @returns {boolean} true if successful, false if no lives available
 */
export function useLife() {
  checkAndRefill();
  if (_lives <= 0) return false;
  _lives--;
  if (_lastUpdate === null) _lastUpdate = Date.now();
  _save();
  return true;
}

/**
 * Add lives (up to max). Used for ad rewards.
 * @returns {number} new lives count
 */
export function addLife(amount = 1) {
  checkAndRefill();
  _lives = Math.min(MAX_LIVES, _lives + amount);
  if (_lives >= MAX_LIVES) _lastUpdate = null;
  _save();
  return _lives;
}

/**
 * Returns the ms timestamp when all lives will be fully restored,
 * or null if already at max.
 */
export function getFullRestoreTime() {
  checkAndRefill();
  if (_lives >= MAX_LIVES || !_lastUpdate) return null;
  return _lastUpdate + (MAX_LIVES - _lives) * RESTORE_MS;
}

/**
 * Seconds until the next life is restored. Returns 0 if at max lives.
 */
export function getRemainingTime() {
  checkAndRefill();
  if (_lives >= MAX_LIVES || !_lastUpdate) return 0;
  const elapsed = Date.now() - _lastUpdate;
  return Math.ceil((RESTORE_MS - (elapsed % RESTORE_MS)) / 1000);
}
