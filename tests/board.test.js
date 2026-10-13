import { describe, it, expect } from 'vitest';
import {
  MIN_GROUP,
  MAX_SPAWN_CLUSTER,
  getGroupCells,
  getGroup,
  predictClusterSize,
  pickSpawnColor,
  findValidGroups,
  findValidGroup,
  hasValidMove,
  isBoardClear,
  applyGravity,
  collapseEmptyColumns,
} from '../src/board.js';

// Build a grid from rows of letters: '.' is empty, any other letter is a colour
function parse(...rows) {
  return rows.map((row, r) => [...row].map((ch, c) => (ch === '.' ? null : { color: ch, r, c })));
}

function render(grid) {
  return grid.map((row) => row.map((cell) => cell?.color ?? '.').join(''));
}

const sortCells = (cells) => cells.map(({ r, c }) => `${r},${c}`).sort();

describe('getGroupCells', () => {
  it('flood-fills orthogonally connected cells of the same colour', () => {
    const grid = parse('aab', 'bab', 'aaa');
    expect(sortCells(getGroupCells(grid, 0, 0))).toEqual([
      '0,0',
      '0,1',
      '1,1',
      '2,0',
      '2,1',
      '2,2',
    ]);
  });

  it('does not connect diagonally', () => {
    const grid = parse('ab', 'ba');
    expect(getGroupCells(grid, 0, 0)).toHaveLength(1);
  });

  it('returns an empty list for an empty cell', () => {
    expect(getGroupCells(parse('.a'), 0, 0)).toEqual([]);
  });

  it('can treat a cell as a different colour without mutating the grid', () => {
    const grid = parse('a.a');
    expect(getGroupCells(grid, 0, 1, 'a')).toHaveLength(3);
    expect(grid[0][1]).toBeNull();
  });
});

describe('getGroup', () => {
  it('returns the grid pieces themselves', () => {
    const grid = parse('aab');
    const group = getGroup(grid, 0, 1);
    expect(group).toContain(grid[0][0]);
    expect(group).toContain(grid[0][1]);
    expect(group).not.toContain(grid[0][2]);
  });
});

describe('pickSpawnColor', () => {
  it(`never creates a cluster larger than ${MAX_SPAWN_CLUSTER}`, () => {
    // Placing 'a' in the gap would join 3 + 3 = 7 cells
    const grid = parse('aaa.aaa');
    for (let i = 0; i < 50; i++) {
      expect(pickSpawnColor(grid, 0, 3, ['a', 'b'])).toBe('b');
    }
  });

  it('falls back to the whole palette when every colour is too big', () => {
    const grid = parse('aaa.aaa');
    expect(pickSpawnColor(grid, 0, 3, ['a'])).toBe('a');
  });

  it('uses the random source to choose between allowed colours', () => {
    const grid = parse('.');
    expect(pickSpawnColor(grid, 0, 0, ['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickSpawnColor(grid, 0, 0, ['a', 'b', 'c'], () => 0.99)).toBe('c');
  });

  it('predicts cluster size including the new piece', () => {
    expect(predictClusterSize(parse('aa.'), 0, 2, 'a')).toBe(3);
    expect(predictClusterSize(parse('aa.'), 0, 2, 'b')).toBe(1);
  });
});

describe('findValidGroups', () => {
  const grid = parse('aabb', 'abbc', 'ccdc', 'ddcc');

  it(`finds every group of at least ${MIN_GROUP}`, () => {
    const groups = findValidGroups(grid);
    expect(groups.map((g) => g.length).sort()).toEqual([3, 4, 4]);
  });

  it('stops at the limit', () => {
    expect(findValidGroups(grid, 1)).toHaveLength(1);
  });

  it('reports a stuck board', () => {
    const stuck = parse('ab', 'ba');
    expect(findValidGroup(stuck)).toBeNull();
    expect(hasValidMove(stuck)).toBe(false);
    expect(hasValidMove(grid)).toBe(true);
  });
});

describe('isBoardClear', () => {
  it('is true only when every cell is empty', () => {
    expect(isBoardClear(parse('..', '..'))).toBe(true);
    expect(isBoardClear(parse('..', '.a'))).toBe(false);
  });
});

describe('applyGravity', () => {
  it('drops pieces to the bottom of each column, keeping their order', () => {
    const grid = parse('ab', '.c', 'd.', '..');
    applyGravity(grid);
    expect(render(grid)).toEqual(['..', '..', 'ab', 'dc']);
  });

  it('returns the new position of every piece that moved', () => {
    const grid = parse('a', '.', 'b');
    const a = grid[0][0];
    expect(applyGravity(grid)).toEqual([{ item: a, r: 1, c: 0 }]);
  });
});

describe('collapseEmptyColumns', () => {
  it('slides columns left over empty ones', () => {
    const grid = parse('.a..b', '.a.cb');
    collapseEmptyColumns(grid);
    expect(render(grid)).toEqual(['a.b..', 'acb..']);
  });

  it('does nothing when there are no gaps', () => {
    const grid = parse('ab.');
    expect(collapseEmptyColumns(grid)).toEqual([]);
    expect(render(grid)).toEqual(['ab.']);
  });
});
