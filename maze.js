// v1.2.1 - Maze templates and factory functions

import { ROWS, COLS, MOVEMENT_DEBUG, DEBUG_ROWS, DEBUG_COLS } from './config.js';

// Debug maze: 11x11 test maze with two 4-way intersections and wrap-around portals
// Vertical bridge at (3,3) with tunnel entrances at (3,2) and (3,4), tunnel path at (3,2) and (3,4) on layer 0
// Horizontal bridge at (7,7) with tunnel entrances at (6,7) and (8,7), tunnel path at (6,7) and (8,7) on layer 0
// Tile types: 0=floor (layer 1), 1=wall, 5=wrap portal (layer 1), 6=bridge (layer 1), 7=switch (layer 1), 8=tunnel path (layer 0)
// Tunnel entrances are floor tiles (0) adjacent to bridges - they allow layer transition
export const MAZE_DEBUG_9x9 = [
  [1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,0,1,0,1,0,1,0,1],  // Wall at (2,4)
  [5,0,8,6,8,0,0,0,0,0,5],  // Row 3: wrap portals (5), tunnel path (8) at (3,2), vertical bridge (6) at (3,3), tunnel path (8) at (3,4), wrap portal
  [1,0,1,0,1,0,1,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,0,1,0,1,8,1,0,1],  // Wall at (6,4), tunnel path (8) at (6,7) for horizontal bridge
  [1,0,0,0,0,0,0,6,0,0,1],  // Row 7: horizontal bridge (6) at (7,7)
  [1,0,1,0,1,0,1,8,1,0,1],  // Wall at (8,4), tunnel path (8) at (8,7) for horizontal bridge
  [1,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1],
];

// Maze templates: 0 floor, 1 wall, 5 portal; 6 bridge, 7 switch (v1.2)
export const MAZE_CLASSIC = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,1],
  [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
  [1,1,1,1,1,0,1,0,1,1,0,1,1,0,1,0,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Variant 1: fully custom layout with wider outer loop and zig-zag center
export const MAZE_CLASSIC_ALT_1 = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
  [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
  [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
  [1,1,1,0,1,0,1,0,1,1,0,1,1,0,1,0,1,0,1,1,1],
  [1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
  [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Variant 2: fully custom layout with boxy rooms and tighter corridors
export const MAZE_CLASSIC_ALT_2 = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1],
  [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,1],
  [1,0,1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,0,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
  [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
  [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,0,1,1],
  [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,1],
  [1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Bridges level: derive from classic and add several 4-way bridges with side portals
export const MAZE_BRIDGES = (() => {
  const base = MAZE_CLASSIC.map((row) => row.slice());

  // Find 4-way intersections: floor with floor in all four directions
  const fourWays = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (base[r][c] !== 0) continue;
      const up = base[r - 1][c];
      const down = base[r + 1][c];
      const left = base[r][c - 1];
      const right = base[r][c + 1];
      if (up === 0 && down === 0 && left === 0 && right === 0) {
        fourWays.push({ row: r, col: c });
      }
    }
  }

  // Use up to three 4-way intersections for bridges
  for (let i = 0; i < fourWays.length && i < 3; i++) {
    const { row, col } = fourWays[i];
    // Bridge tile itself
    base[row][col] = 6;
    // Block the horizontal surface path with portals that tunnel under the bridge
    base[row][col - 1] = 5;
    base[row][col + 1] = 5;
    // Vertical neighbors remain floor (straight crossing over the bridge)
  }

  return base;
})();

// Switches level: derive from classic and place switches only at 4-way intersections (tile 7)
export const MAZE_SWITCHES = (() => {
  const base = MAZE_CLASSIC.map((row) => row.slice());

  const fourWays = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (base[r][c] !== 0) continue;
      const up = base[r - 1][c];
      const down = base[r + 1][c];
      const left = base[r][c - 1];
      const right = base[r][c + 1];
      if (up === 0 && down === 0 && left === 0 && right === 0) {
        fourWays.push({ row: r, col: c });
      }
    }
  }

  // Choose up to three 4-way intersections to host switches
  for (let i = 0; i < fourWays.length && i < 3; i++) {
    const { row, col } = fourWays[i];
    base[row][col] = 7;
  }

  return base;
})();

// Combined level: start from bridges layout and add switches at remaining 4-way intersections
export const MAZE_BRIDGES_SWITCHES = (() => {
  const base = MAZE_BRIDGES.map((row) => row.slice());
  const fourWays = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (base[r][c] !== 0) continue;
      const up = base[r - 1][c];
      const down = base[r + 1][c];
      const left = base[r][c - 1];
      const right = base[r][c + 1];
      if (up === 0 && down === 0 && left === 0 && right === 0) {
        fourWays.push({ row: r, col: c });
      }
    }
  }
  for (let i = 0; i < fourWays.length && i < 2; i++) {
    const { row, col } = fourWays[i];
    base[row][col] = 7;
  }
  return base;
})();

// Maze factory functions
export function pickTemplateForLevel(level) {
  switch (level.type) {
    case "bridges":
      return MAZE_BRIDGES;
    case "switches":
      return MAZE_SWITCHES;
    case "bridges_switches":
      return MAZE_BRIDGES_SWITCHES;
    case "classic":
    default: {
      // Level 1 always uses the base classic maze, others can be random
      if (level.id === 1) {
        return MAZE_CLASSIC;
      }
      // Randomly pick one of the three classic layouts for other classic levels
      const classicVariants = [MAZE_CLASSIC, MAZE_CLASSIC_ALT_1, MAZE_CLASSIC_ALT_2];
      const idx = Math.floor(Math.random() * classicVariants.length);
      return classicVariants[idx];
    }
  }
}

export function buildPortalsFromMaze(sourceMaze) {
  const used = new Set();
  const pairs = [];
  const key = (r, c) => `${r},${c}`;

  // Determine grid dimensions based on maze size
  const mazeRows = sourceMaze.length;
  const mazeCols = sourceMaze[0]?.length || 0;

  // 1) Classic side portals: pair left/right edges on the same row.
  for (let r = 0; r < mazeRows; r++) {
    if (sourceMaze[r][0] === 5 && sourceMaze[r][mazeCols - 1] === 5) {
      pairs.push({
        a: { row: r, col: 0 },
        b: { row: r, col: mazeCols - 1 },
      });
      used.add(key(r, 0));
      used.add(key(r, mazeCols - 1));
    }
  }

  // 2) Bridge tunnels: for each row, look for 5,6,5 patterns and pair the 5s.
  for (let r = 0; r < mazeRows; r++) {
    for (let c = 1; c < mazeCols - 2; c++) {
      if (sourceMaze[r][c] === 5 &&
          sourceMaze[r][c + 1] === 6 &&
          sourceMaze[r][c + 2] === 5 &&
          !used.has(key(r, c)) &&
          !used.has(key(r, c + 2))) {
        pairs.push({
          a: { row: r, col: c },
          b: { row: r, col: c + 2 },
        });
        used.add(key(r, c));
        used.add(key(r, c + 2));
        c += 2; // skip over this bridge pair
      }
    }
  }

  return pairs;
}

export function buildSwitchesFromMaze(sourceMaze) {
  const result = [];
  const mazeRows = sourceMaze.length;
  const mazeCols = sourceMaze[0]?.length || 0;
  for (let r = 0; r < mazeRows; r++) {
    for (let c = 0; c < mazeCols; c++) {
      if (sourceMaze[r][c] === 7) {
        // Alternate initial mode for a bit of variety
        const mode = (result.length % 2 === 0) ? "vertical" : "horizontal";
        result.push({ row: r, col: c, mode, pending: false, timer: 0 });
      }
    }
  }
  return result;
}

export function createMazeForLevel(levelConfig) {
  // Check for movement debug mode
  if (MOVEMENT_DEBUG) {
    const newMaze = MAZE_DEBUG_9x9.map((row) => row.slice());
    const newPortals = buildPortalsFromMaze(newMaze);
    const newSwitches = []; // No switches in debug mode

    // Spawn positions for debug mode
    const spawns = {
      player: { row: 1, col: 1 },
      // No unicorn spawn in debug mode
    };

    return { maze: newMaze, portals: newPortals, switches: newSwitches, spawns };
  }

  const template = pickTemplateForLevel(levelConfig);
  const newMaze = template.map((row) => row.slice());
  const newPortals = buildPortalsFromMaze(newMaze);
  const newSwitches = buildSwitchesFromMaze(newMaze);

  // Spawn positions expressed in grid coordinates
  const spawns = {
    player: { row: 1, col: 1 },
    unicorn: { row: 13, col: 19 },
  };

  return { maze: newMaze, portals: newPortals, switches: newSwitches, spawns };
}

