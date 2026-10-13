import { describe, it, expect, beforeEach } from 'vitest';
import { getStreakData, recordActiveDay, STREAK_REWARDS } from '../src/streak.js';

// Local dates, so the tests behave the same in any time zone
const day = (n, hour = 12) => new Date(2026, 0, n, hour);

describe('active streak', () => {
  beforeEach(() => localStorage.clear());

  it('starts at day 1', () => {
    recordActiveDay(day(1));
    expect(getStreakData().count).toBe(1);
  });

  it('counts each day only once', () => {
    recordActiveDay(day(1, 9));
    recordActiveDay(day(1, 23));
    expect(getStreakData().count).toBe(1);
  });

  it('grows on consecutive days', () => {
    for (let d = 1; d <= 5; d++) recordActiveDay(day(d));
    expect(getStreakData().count).toBe(5);
  });

  it('restarts at 1 after a missed day', () => {
    recordActiveDay(day(1));
    recordActiveDay(day(2));
    recordActiveDay(day(4));
    expect(getStreakData().count).toBe(1);
  });

  it('flips at local midnight', () => {
    recordActiveDay(day(1, 23));
    recordActiveDay(day(2, 0));
    expect(getStreakData().count).toBe(2);
  });

  it('pays every milestone reward exactly on its day', () => {
    const rewards = [];
    for (let d = 1; d <= 30; d++) {
      const reward = recordActiveDay(day(d));
      if (reward) rewards.push(reward);
    }
    expect(rewards).toEqual(STREAK_REWARDS.map((r) => ({ days: r.day, coins: r.coins })));
  });

  it('recovers from corrupted storage', () => {
    localStorage.setItem('gloop_active_streak', '{not json');
    expect(getStreakData()).toEqual({ count: 0, lastDate: null });
    recordActiveDay(day(1));
    expect(getStreakData().count).toBe(1);
  });
});
