// v1.2.1 - Game configuration and constants

// Debug toggles (set true to log to console / draw helpers)
export const DEBUG_PLAYER = false;
export const DEBUG_UNICORN = false;
export const DEBUG_PORTALS = false;
export const DEBUG_BRIDGES = false;
export const DEBUG_SWITCHES = false;
// When set to a number (0-based), start directly on that level for testing
export const DEBUG_START_LEVEL = 1; // e.g. 2 to start on level 3, null for default
// Movement debug mode: false, "bridges", "switches", or "unicorn_ai"
// - false: normal game mode
// - "bridges": test maze with bridges and tunnels (current)
// - "switches": test maze with switches
// - "unicorn_ai": test maze with unicorn AI behavior
export const MOVEMENT_DEBUG = "switches"; // Set to false, "bridges", "switches", or "unicorn_ai"

// Game constants
export const TILE = 32;
export const ROWS = 15;
export const COLS = 21;
// Debug mode dimensions
export const DEBUG_ROWS = 11;
export const DEBUG_COLS = 11;
// Canvas dimensions (adjusted for debug mode - HUD is separate HTML element)
export const CANVAS_W = MOVEMENT_DEBUG ? DEBUG_COLS * TILE : COLS * TILE;
export const CANVAS_H = MOVEMENT_DEBUG ? DEBUG_ROWS * TILE : ROWS * TILE;

// Helper to check if any debug mode is active
export const isMovementDebug = () => MOVEMENT_DEBUG !== false;

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
  TUTORIAL: "tutorial", // v1.3
  ENTER_HIGH_SCORE: "enter_high_score", // v1.3
  SHOW_HIGH_SCORES: "show_high_scores", // v1.3
};

// v1.3: Lives system
export const INITIAL_LIVES = 3;
export const EXTRA_LIFE_SCORE_MILESTONE = 1000;

// v1.3: High score system
export const HIGH_SCORE_STORAGE_KEY = "unicornRun_highScores";
export const HIGH_SCORE_SCHEMA_VERSION = 1;
export const MAX_HIGH_SCORES = 10;

