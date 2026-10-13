import { describe, it, expect } from 'vitest';
import {
  COMBO_MULTIPLIERS,
  COMBO_WINDOW_MS,
  calculatePoints,
  nextComboLevel,
  getStarCount,
  getStarProgress,
} from '../src/scoring.js';

describe('calculatePoints', () => {
  it('rewards bigger groups', () => {
    expect([3, 4, 5, 6, 7, 20].map(calculatePoints)).toEqual([100, 300, 800, 1500, 3000, 3000]);
  });
});

describe('nextComboLevel', () => {
  it('starts at zero on the first pop', () => {
    expect(nextComboLevel(0, null)).toBe(0);
  });

  it('climbs while pops land inside the window', () => {
    expect(nextComboLevel(0, 500)).toBe(1);
    expect(nextComboLevel(2, COMBO_WINDOW_MS - 1)).toBe(3);
  });

  it('caps at the highest multiplier', () => {
    const max = COMBO_MULTIPLIERS.length - 1;
    expect(nextComboLevel(max, 100)).toBe(max);
  });

  it('resets when the window has passed', () => {
    expect(nextComboLevel(3, COMBO_WINDOW_MS)).toBe(0);
  });
});

describe('stars', () => {
  const target = 1000;

  it('awards stars at the target, +10% and +25%', () => {
    expect(getStarCount(999, target)).toBe(0);
    expect(getStarCount(1000, target)).toBe(1);
    expect(getStarCount(1100, target)).toBe(2);
    expect(getStarCount(1250, target)).toBe(3);
  });

  it('reports progress towards the next star between 0 and 1', () => {
    expect(getStarProgress(500, target)).toBe(0.5);
    expect(getStarProgress(1050, target)).toBeCloseTo(0.5);
    expect(getStarProgress(1175, target)).toBeCloseTo(0.5);
    expect(getStarProgress(5000, target)).toBe(1);
  });
});
