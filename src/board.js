// Pure board logic: no DOM, no globals. The grid is a rows x cols array where
// each cell is null or an object with at least a `color` field. Functions that
// move pieces mutate the grid and return the moves so the caller can sync the UI.

export const MIN_GROUP = 3;
// Spawned pieces never create a same-colour cluster larger than this
export const MAX_SPAWN_CLUSTER = 5;

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(grid, r, c) {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
}

/**
 * Flood-fill the same-coloured group containing (r, c).
 * Returns the cells as { r, c } in visit order, or [] for an empty cell.
 * `colorAt` overrides the colour at (r, c) without touching the grid.
 */
export function getGroupCells(grid, r, c, colorAt = null) {
  const color = colorAt ?? grid[r]?.[c]?.color;
  if (!color) return [];

  const colorOf = (rr, cc) => (rr === r && cc === c ? color : grid[rr][cc]?.color);
  const seen = new Set([`${r},${c}`]);
  const cells = [];
  const queue = [{ r, c }];

  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    cells.push(cur);
    for (const [dr, dc] of NEIGHBOURS) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      const key = `${nr},${nc}`;
      if (!inBounds(grid, nr, nc) || seen.has(key) || colorOf(nr, nc) !== color) continue;
      seen.add(key);
      queue.push({ r: nr, c: nc });
    }
  }
  return cells;
}

/** The pieces (grid objects) in the group containing (r, c). */
export function getGroup(grid, r, c) {
  return getGroupCells(grid, r, c).map(({ r: gr, c: gc }) => grid[gr][gc]);
}

/** Size of the cluster (r, c) would belong to if it had `color`. */
export function predictClusterSize(grid, r, c, color) {
  return getGroupCells(grid, r, c, color).length;
}

/**
 * Pick a colour for a new piece at (r, c), avoiding colours that would form a
 * cluster bigger than MAX_SPAWN_CLUSTER. Falls back to any colour if all would.
 */
export function pickSpawnColor(grid, r, c, palette, random = Math.random) {
  let allowed = palette.filter(
    (color) => predictClusterSize(grid, r, c, color) <= MAX_SPAWN_CLUSTER,
  );
  if (allowed.length === 0) allowed = palette;
  return allowed[Math.floor(random() * allowed.length)];
}

/**
 * Find poppable groups (size >= MIN_GROUP), scanning row by row.
 * Stops early once `limit` groups are found.
 */
export function findValidGroups(grid, limit = Infinity) {
  const visited = new Set();
  const groups = [];

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c] || visited.has(`${r},${c}`)) continue;
      const cells = getGroupCells(grid, r, c);
      cells.forEach((cell) => visited.add(`${cell.r},${cell.c}`));
      if (cells.length >= MIN_GROUP) {
        groups.push(cells);
        if (groups.length >= limit) return groups;
      }
    }
  }
  return groups;
}

/** The first poppable group as { r, c } cells, or null if the board is stuck. */
export function findValidGroup(grid) {
  return findValidGroups(grid, 1)[0] ?? null;
}

export function hasValidMove(grid) {
  return findValidGroup(grid) !== null;
}

export function isBoardClear(grid) {
  return grid.every((row) => row.every((cell) => !cell));
}

/**
 * Drop pieces down to fill gaps in every column.
 * Returns [{ item, r, c }] with the new position of each piece that moved.
 */
export function applyGravity(grid) {
  const moves = [];
  const rows = grid.length;
  for (let c = 0; c < grid[0].length; c++) {
    let target = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const item = grid[r][c];
      if (!item) continue;
      if (r !== target) {
        grid[target][c] = item;
        grid[r][c] = null;
        moves.push({ item, r: target, c });
      }
      target--;
    }
  }
  return moves;
}

/**
 * Slide columns left over fully empty columns.
 * Returns [{ item, r, c }] with the new position of each piece that moved.
 */
export function collapseEmptyColumns(grid) {
  const moves = [];
  let emptyCols = 0;
  for (let c = 0; c < grid[0].length; c++) {
    const isEmpty = grid.every((row) => !row[c]);
    if (isEmpty) {
      emptyCols++;
      continue;
    }
    if (emptyCols === 0) continue;
    const newC = c - emptyCols;
    for (let r = 0; r < grid.length; r++) {
      const item = grid[r][c];
      if (!item) continue;
      grid[r][newC] = item;
      grid[r][c] = null;
      moves.push({ item, r, c: newC });
    }
  }
  return moves;
}
