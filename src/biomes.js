/**
 * biomes.js — BiomeBlockTemplate system for infinite progression
 *
 * Each biome = 15 levels grouped in a "block".
 * After 10 biomes (150 levels), procedural generation recycles visuals.
 */

// ======================== DIFFICULTY WAVE PATTERN ========================
// Each block of 15 levels follows a sawtooth wave:
// 1-3: Easy, 4-8: Medium, 9-11: Hard, 12: Easy (breather), 13-14: Hard, 15: Extreme (Boss)
const WAVE_PATTERN_15 = [
  'easy',
  'medium',
  'easy',
  'medium',
  'medium',
  'hard',
  'easy',
  'medium',
  'hard',
  'medium',
  'hard',
  'easy',
  'hard',
  'hard',
  'extreme',
];

// ======================== GRID CONFIGS BY DIFFICULTY ========================
function getGridConfig(difficulty, blockIndex) {
  // Progressive scaling: later blocks get slightly bigger grids
  const scale = Math.min(blockIndex, 5); // Cap at block 6 for grid growth

  switch (difficulty) {
    case 'easy':
      return { rows: 5 + Math.min(scale, 2), cols: 5 + Math.min(scale, 2), colors: 3 };
    case 'medium':
      return {
        rows: 7 + Math.min(scale, 2),
        cols: 7 + Math.min(scale, 2),
        colors: Math.min(3 + Math.floor(scale / 2), 4),
      };
    case 'hard':
      return {
        rows: 8 + Math.min(scale, 2),
        cols: 8 + Math.min(scale, 2),
        colors: Math.min(4 + Math.floor(scale / 3), 5),
      };
    case 'extreme':
      return {
        rows: 9 + Math.min(scale, 1),
        cols: 9 + Math.min(scale, 1),
        colors: Math.min(5 + Math.floor(scale / 4), 6),
      };
    default:
      return { rows: 7, cols: 7, colors: 4 };
  }
}

// ======================== DENSITY-BASED SCORING ========================
function calculateTargetScore(gridWidth, gridHeight, colorCount, difficulty) {
  const D = (gridWidth * gridHeight) / colorCount;
  let PEM, ME;

  if (D < 10.0) {
    PEM = 200;
    ME = 15;
  } else if (D < 15.0) {
    PEM = 450;
    ME = 12;
  } else if (D < 20.0) {
    PEM = 900;
    ME = 8;
  } else {
    PEM = 1800;
    ME = 5;
  }

  const baseScore = PEM * ME;
  const multipliers = { easy: 0.6, medium: 1.0, hard: 1.4, extreme: 1.8 };
  return Math.round((baseScore * (multipliers[difficulty] || 1.0)) / 50) * 50;
}

// ======================== 10 BASE BIOME DEFINITIONS ========================
export const BASE_BIOMES = [
  {
    blockId: 1,
    biomeName: 'biome_neon_forest',
    themeColors: ['#0a1f0a', '#0d2b0d', '#071507'],
    imagePath: './assets/biomes/neon_forest.png',
  },
  {
    blockId: 2,
    biomeName: 'biome_crystal_caves',
    themeColors: ['#060d1a', '#0a1428', '#040a12'],
    imagePath: './assets/biomes/crystal_caves.png',
  },
  {
    blockId: 3,
    biomeName: 'biome_abyssal_reef',
    themeColors: ['#071414', '#0a1e1e', '#050f0f'],
    imagePath: './assets/biomes/abyssal_reef.png',
  },
  {
    blockId: 4,
    biomeName: 'biome_radioactive_swamp',
    themeColors: ['#121208', '#1a1a0c', '#0d0d06'],
    imagePath: './assets/biomes/radioactive_swamp.png',
  },
  {
    blockId: 5,
    biomeName: 'biome_plasma_core',
    themeColors: ['#1a0808', '#200a0a', '#120505'],
    imagePath: './assets/biomes/plasma_core.png',
  },
  {
    blockId: 6,
    biomeName: 'biome_phosphor_dunes',
    themeColors: ['#1a1208', '#201a0c', '#120d05'],
    imagePath: './assets/biomes/phosphor_dunes.png',
  },
  {
    blockId: 7,
    biomeName: 'biome_tritium_glacier',
    themeColors: ['#0d1014', '#101418', '#0a0d10'],
    imagePath: './assets/biomes/tritium_glacier.png',
  },
  {
    blockId: 8,
    biomeName: 'biome_spore_jungle',
    themeColors: ['#140a18', '#1a0e20', '#0f0812'],
    imagePath: './assets/biomes/spore_jungle.png',
  },
  {
    blockId: 9,
    biomeName: 'biome_antimatter_canyon',
    themeColors: ['#0a0a0a', '#080808', '#0c0c0c'],
    imagePath: './assets/biomes/antimatter_canyon.png',
  },
  {
    blockId: 10,
    biomeName: 'biome_gloop_nebula',
    themeColors: ['#080d1a', '#0a1020', '#060a14'],
    imagePath: './assets/biomes/gloop_nebula.png',
  },
];

// ======================== BIOME BLOCK TEMPLATE ========================

/**
 * BiomeBlockTemplate
 * @typedef {Object} BiomeBlockTemplate
 * @property {number} blockId - 1-indexed block number
 * @property {string} biomeName - i18n key for the biome name
 * @property {string[]} themeColors - Array of hex colors for background gradient
 * @property {LevelData[]} levels - Exactly 15 LevelData entries
 */

/**
 * @typedef {Object} LevelData
 * @property {number} target - Points to pass the level
 * @property {number} rows - Grid rows
 * @property {number} cols - Grid columns
 * @property {number} colors - Number of ball colors
 * @property {string} difficulty - 'easy' | 'medium' | 'hard' | 'extreme'
 */

/**
 * Generate a BiomeBlockTemplate for a given block index (0-based).
 * Blocks 0-9 are the base biomes. Blocks 10+ recycle visuals cyclically.
 */
export function generateBiomeBlock(blockIndex) {
  const baseIndex = blockIndex % BASE_BIOMES.length;
  const baseBiome = BASE_BIOMES[baseIndex];

  const levels = [];
  for (let i = 0; i < 15; i++) {
    // Block 1: Intro levels are easy (1-5), then it follows the wave pattern but capped at medium
    let difficulty = WAVE_PATTERN_15[i];
    if (blockIndex === 0) {
      if (i < 5) difficulty = 'easy';
      else if (difficulty === 'hard' || difficulty === 'extreme') difficulty = 'medium';
    }
    let gridConfig = getGridConfig(difficulty, blockIndex);

    // Progressive grid: Block N starts at (5+N)×(5+N), ends at (6+N)×(6+N), capped at 12
    const minSize = Math.min(5 + blockIndex, 12);
    const maxSize = Math.min(6 + blockIndex, 12);
    // Interpolate based on position (0-14), with level 12 as breather (drops to min)
    let size;
    if (i === 11) {
      // Level 12 = breather, drop back to min
      size = minSize;
    } else {
      // Smooth ramp: first ~6 levels at min, rest at max
      size = i < 6 ? minSize : maxSize;
    }
    gridConfig = { ...gridConfig, rows: size, cols: size };

    let target = calculateTargetScore(
      gridConfig.rows,
      gridConfig.cols,
      gridConfig.colors,
      difficulty,
    );

    // Block 1 easing: reduce targets by 40% for a gentle intro
    if (blockIndex === 0) {
      target = Math.round((target * 0.6) / 50) * 50;
    }

    const levelData = {
      target,
      rows: gridConfig.rows,
      cols: gridConfig.cols,
      colors: gridConfig.colors,
      difficulty,
    };

    // Booster-tutorial levels (block 2 positions 0/5/10 → global 16, 21, 26) are
    // forced easy so the player can focus on learning the new booster
    if (blockIndex === 1 && (i === 0 || i === 5 || i === 10)) {
      levelData.difficulty = 'easy';
      const easyConfig = getGridConfig('easy', blockIndex);
      levelData.rows = easyConfig.rows;
      levelData.cols = easyConfig.cols;
      levelData.colors = easyConfig.colors;
      levelData.target = calculateTargetScore(
        easyConfig.rows,
        easyConfig.cols,
        easyConfig.colors,
        'easy',
      );
    }

    levels.push(levelData);
  }

  return {
    blockId: blockIndex + 1,
    biomeName: baseBiome.biomeName,
    themeColors: baseBiome.themeColors,
    imagePath: baseBiome.imagePath,
    levels,
  };
}

// ======================== LEVEL ACCESS HELPERS ========================

// Cache generated blocks for performance
const _blockCache = new Map();

/**
 * Get the biome block for a given global level (1-indexed).
 * @param {number} globalLevel - 1-indexed level number
 * @returns {{ block: BiomeBlockTemplate, localIndex: number }}
 */
export function getBlockForLevel(globalLevel) {
  const blockIndex = Math.floor((globalLevel - 1) / 15);
  if (!_blockCache.has(blockIndex)) {
    _blockCache.set(blockIndex, generateBiomeBlock(blockIndex));
  }
  return {
    block: _blockCache.get(blockIndex),
    localIndex: (globalLevel - 1) % 15,
  };
}

/**
 * Get the LevelData for a given global level (1-indexed).
 * Works for ANY level number (infinite).
 */
export function getLevelData(globalLevel) {
  const { block, localIndex } = getBlockForLevel(globalLevel);
  return block.levels[localIndex];
}

/**
 * Get the total number of pre-defined biome blocks.
 */
export function getBaseBiomeCount() {
  return BASE_BIOMES.length;
}

/**
 * Get how many future biomes to show ahead (fog of war: max 3).
 */
export function getVisibleBiomeRange(currentLevel) {
  const currentBlock = Math.floor((currentLevel - 1) / 15);
  return {
    currentBlock,
    maxVisibleBlock: currentBlock + 3,
  };
}

/**
 * Check if a biome block is revealed (player has reached at least level 1 of it).
 */
export function isBiomeRevealed(blockIndex, maxReachedLevel) {
  const firstLevelOfBlock = blockIndex * 15 + 1;
  return maxReachedLevel >= firstLevelOfBlock;
}
