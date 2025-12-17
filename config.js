// v1.2.1 - Game configuration and constants

// Debug toggles (set true to log to console / draw helpers)
export const DEBUG_PLAYER = false;
export const DEBUG_UNICORN = false;
export const DEBUG_PORTALS = false;
export const DEBUG_BRIDGES = false;
export const DEBUG_SWITCHES = false;
// When set to a number (0-based), start directly on that level for testing
export const DEBUG_START_LEVEL = null; // e.g. 2 to start on level 3, null for default

// Game constants
export const TILE = 32;
export const ROWS = 15;
export const COLS = 21;
export const CANVAS_W = COLS * TILE;
export const CANVAS_H = ROWS * TILE;

export const PLAYER_SPEED = 180;
export const UNICORN_SPEED = 115;
export const INVINCIBLE_SECONDS = 6;
export const GEM_RESPAWN_MS = 2500;
export const RANDOM_INTERSECTION_COUNT = 2;

// Game states
export const STATE = {
  TITLE: "title",
  PLAYING_NORMAL: "playing_normal",
  PLAYING_INVINCIBLE: "playing_invincible",
  PAUSED: "paused",
  GAMEOVER: "gameover",
  WIN: "win",
};

