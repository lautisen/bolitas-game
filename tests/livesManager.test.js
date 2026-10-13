import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const RESTORE_MS = 10 * 60 * 1000;

// The module reads its state at import time, so load a fresh copy for each test
async function loadLives() {
  vi.resetModules();
  return import('../src/livesManager.js');
}

describe('livesManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with full lives', async () => {
    const lives = await loadLives();
    expect(lives.getLives()).toBe(lives.getMaxLives());
    expect(lives.getRemainingTime()).toBe(0);
    expect(lives.getFullRestoreTime()).toBeNull();
  });

  it('consumes lives until none are left', async () => {
    const lives = await loadLives();
    for (let i = 0; i < lives.getMaxLives(); i++) {
      expect(lives.useLife()).toBe(true);
    }
    expect(lives.getLives()).toBe(0);
    expect(lives.useLife()).toBe(false);
  });

  it('restores one life per interval', async () => {
    const lives = await loadLives();
    lives.useLife();
    lives.useLife();
    expect(lives.getLives()).toBe(3);

    vi.advanceTimersByTime(RESTORE_MS - 1);
    expect(lives.getLives()).toBe(3);

    vi.advanceTimersByTime(1);
    expect(lives.getLives()).toBe(4);

    vi.advanceTimersByTime(RESTORE_MS);
    expect(lives.getLives()).toBe(5);
    expect(lives.getFullRestoreTime()).toBeNull();
  });

  it('never restores above the maximum after a long absence', async () => {
    const lives = await loadLives();
    lives.useLife();
    vi.advanceTimersByTime(RESTORE_MS * 100);
    expect(lives.getLives()).toBe(lives.getMaxLives());
  });

  it('reports when all lives will be restored', async () => {
    const lives = await loadLives();
    lives.useLife();
    lives.useLife();
    expect(lives.getFullRestoreTime()).toBe(Date.now() + 2 * RESTORE_MS);
    expect(lives.getRemainingTime()).toBe(RESTORE_MS / 1000);
  });

  it('caps rewarded lives at the maximum', async () => {
    const lives = await loadLives();
    lives.useLife();
    expect(lives.addLife(10)).toBe(lives.getMaxLives());
    expect(lives.getRemainingTime()).toBe(0);
  });

  it('persists state across reloads', async () => {
    let lives = await loadLives();
    lives.useLife();
    lives = await loadLives();
    expect(lives.getLives()).toBe(4);
  });
});
