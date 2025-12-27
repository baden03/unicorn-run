// v1.2.1 - Level definitions and management

import { ROWS, COLS } from './config.js';
import { createMazeForLevel } from './maze.js';

export const levels = [
  { 
    id: 1, 
    name: "Classic", 
    type: "classic", 
    rows: ROWS, 
    cols: COLS, 
    portals: true,
    unicorns: [{ type: "classic", spawn: { row: 13, col: 19 } }]
  },
  { 
    id: 2, 
    name: "Bridges", 
    type: "bridges", 
    rows: ROWS, 
    cols: COLS, 
    portals: true,
    unicorns: [{ type: "classic", spawn: { row: 13, col: 19 } }]
  },
  { 
    id: 3, 
    name: "Switches", 
    type: "switches", 
    rows: ROWS, 
    cols: COLS, 
    portals: true,
    unicorns: [{ type: "classic", spawn: { row: 13, col: 19 } }]
  },
  { 
    id: 4, 
    name: "Bridges+Switches", 
    type: "bridges_switches", 
    rows: ROWS, 
    cols: COLS, 
    portals: true,
    unicorns: [
      { type: "classic", spawn: { row: 13, col: 19 } },
      { type: "drunky", spawn: { row: 1, col: 19 } }
    ]
  },
];

export function showLevelIntro(currentLevelIndex) {
  const level = levels[currentLevelIndex];
  return {
    text: `Level ${currentLevelIndex + 1}: ${level.name}`,
    timer: 1.5
  };
}

