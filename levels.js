// v1.2.1 - Level definitions and management

import { ROWS, COLS } from './config.js';
import { createMazeForLevel } from './maze.js';

export const levels = [
  { id: 1, name: "Classic",          type: "classic",          rows: ROWS, cols: COLS, portals: true },
  { id: 2, name: "Bridges",          type: "bridges",          rows: ROWS, cols: COLS, portals: true },
  { id: 3, name: "Switches",         type: "switches",         rows: ROWS, cols: COLS, portals: true },
  { id: 4, name: "Bridges+Switches", type: "bridges_switches", rows: ROWS, cols: COLS, portals: true },
];

export function showLevelIntro(currentLevelIndex) {
  const level = levels[currentLevelIndex];
  return {
    text: `Level ${currentLevelIndex + 1}: ${level.name}`,
    timer: 1.5
  };
}

