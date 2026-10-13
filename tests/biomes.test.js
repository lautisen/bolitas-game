import { describe, it, expect } from 'vitest';
import {
  BASE_BIOMES,
  generateBiomeBlock,
  getBlockForLevel,
  getLevelData,
  getVisibleBiomeRange,
  isBiomeRevealed,
} from '../src/biomes.js';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'];

describe('generateBiomeBlock', () => {
  it('always produces exactly 15 levels', () => {
    for (let b = 0; b < 30; b++) {
      expect(generateBiomeBlock(b).levels).toHaveLength(15);
    }
  });

  it('produces valid level data for the first 100 blocks', () => {
    for (let b = 0; b < 100; b++) {
      for (const level of generateBiomeBlock(b).levels) {
        expect(DIFFICULTIES).toContain(level.difficulty);
        expect(level.target).toBeGreaterThan(0);
        expect(level.target % 50).toBe(0);
        expect(level.rows).toBeGreaterThanOrEqual(5);
        expect(level.rows).toBeLessThanOrEqual(12);
        expect(level.cols).toBe(level.rows);
        expect(level.colors).toBeGreaterThanOrEqual(3);
        expect(level.colors).toBeLessThanOrEqual(6);
      }
    }
  });

  it('keeps the first block gentle: easy intro and no hard or boss levels', () => {
    const { levels } = generateBiomeBlock(0);
    levels.slice(0, 5).forEach(l => expect(l.difficulty).toBe('easy'));
    levels.forEach(l => expect(['easy', 'medium']).toContain(l.difficulty));
  });

  it('ends every later block with an extreme boss level', () => {
    for (let b = 1; b < 20; b++) {
      expect(generateBiomeBlock(b).levels[14].difficulty).toBe('extreme');
    }
  });

  it('forces booster tutorial levels 16, 21 and 26 to easy', () => {
    for (const globalLevel of [16, 21, 26]) {
      expect(getLevelData(globalLevel).difficulty).toBe('easy');
    }
  });

  it('recycles base biome visuals after the last base biome', () => {
    const n = BASE_BIOMES.length;
    const first = generateBiomeBlock(0);
    const recycled = generateBiomeBlock(n);
    expect(recycled.biomeName).toBe(first.biomeName);
    expect(recycled.imagePath).toBe(first.imagePath);
    expect(recycled.blockId).toBe(n + 1);
  });
});

describe('level lookup', () => {
  it('maps global levels to blocks and local indices', () => {
    expect(getBlockForLevel(1)).toMatchObject({ localIndex: 0, block: { blockId: 1 } });
    expect(getBlockForLevel(15)).toMatchObject({ localIndex: 14, block: { blockId: 1 } });
    expect(getBlockForLevel(16)).toMatchObject({ localIndex: 0, block: { blockId: 2 } });
  });

  it('caches generated blocks', () => {
    expect(getBlockForLevel(31).block).toBe(getBlockForLevel(45).block);
  });

  it('supports arbitrarily high levels', () => {
    expect(getLevelData(10_000)).toBeDefined();
  });
});

describe('biome visibility', () => {
  it('shows up to three biomes ahead of the current one', () => {
    expect(getVisibleBiomeRange(1)).toEqual({ currentBlock: 0, maxVisibleBlock: 3 });
    expect(getVisibleBiomeRange(16)).toEqual({ currentBlock: 1, maxVisibleBlock: 4 });
  });

  it('reveals a biome once its first level is reached', () => {
    expect(isBiomeRevealed(1, 15)).toBe(false);
    expect(isBiomeRevealed(1, 16)).toBe(true);
  });
});
