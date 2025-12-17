// v1.3.0 - Main game orchestrator

import {
  DEBUG_START_LEVEL,
  CANVAS_W,
  CANVAS_H,
  TILE,
  ROWS,
  COLS,
  INVINCIBLE_SECONDS,
  GEM_RESPAWN_MS,
  STATE,
} from './config.js';

import { pixelToGrid, gridToPixel, rectanglesOverlap, tileAt } from './utils.js';
import { createMazeForLevel } from './maze.js';
import { levels, showLevelIntro } from './levels.js';
import { resetEntities, seedDotsFromMaze, placeGem } from './entities.js';
import { keys, setupInput } from './input.js';
import { updatePlayer } from './movement.js';
import { updateUnicorn, chooseAvoidDirection } from './ai.js';
import { draw } from './rendering.js';

// DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const joystickLeft = document.getElementById("joystickLeft");
const joystickRight = document.getElementById("joystickRight");

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Game state
let currentLevelIndex = 0;
let maze = [];
let portals = [];
let switches = [];
let gameState = STATE.TITLE;
let score = 0;
let invincibleTimer = 0;
let gemCooldown = 0;
let randomStepsLeft = 0;
let unicornTrail = [];
let unicornStars = [];
let unicornTagged = false;
let floatTexts = [];
let unicornRespawnPause = 0;
let gemsCollected = 0;
let levelIntroTimer = 0;
let levelIntroText = "";
let lastPlayerTileRow = null;
let lastPlayerTileCol = null;

let player = {};
let unicorn = {};
let dots = new Set();
let gem = { x: 0, y: 0, w: 18, h: 18 };

// Helper function to get switch at position
function getSwitchAt(row, col) {
  return switches.find((s) => s.row === row && s.col === col) || null;
}

// Level management
function loadLevel(index, options = {}) {
  const { resetScore = false, showIntro = true } = options;
  currentLevelIndex = index;
  const level = levels[currentLevelIndex];
  const { maze: newMaze, portals: newPortals, switches: newSwitches, spawns } =
    createMazeForLevel(level);
  maze = newMaze;
  portals = newPortals;
  switches = newSwitches;
  
  const entities = resetEntities(spawns);
  player = entities.player;
  unicorn = entities.unicorn;
  
  dots = seedDotsFromMaze(maze, level, spawns);
  gemCooldown = 0;
  const newGem = placeGem(dots);
  if (newGem) {
    gem = newGem;
  }
  
  if (resetScore) score = 0;
  
  if (showIntro) {
    const intro = showLevelIntro(currentLevelIndex);
    levelIntroText = intro.text;
    levelIntroTimer = intro.timer;
  }
  
  gameState = STATE.PLAYING_NORMAL;
  invincibleTimer = 0;
  randomStepsLeft = 0;
  unicornTrail = [];
  unicornStars = [];
  unicornTagged = false;
  floatTexts = [];
  unicornRespawnPause = 0;
  gemsCollected = 0;
  lastPlayerTileRow = null;
  lastPlayerTileCol = null;
  
  updateUI();
}

function updateUI() {
  scoreEl.textContent = `Score: ${score}`;
  const stateText = {
    [STATE.TITLE]: "Press Space or Start",
    [STATE.PLAYING_NORMAL]: "Collect dots + gems!",
    [STATE.PLAYING_INVINCIBLE]: "Invincible! Avoid walls.",
    [STATE.PAUSED]: "Paused - Press Space or Resume",
    [STATE.GAMEOVER]: "Game Over - press Space or Start",
    [STATE.WIN]: "You win! Press Space or Start",
  };
  statusEl.textContent = stateText[gameState];
  if (levelEl) {
    levelEl.textContent = `Level: ${currentLevelIndex + 1} / ${levels.length}`;
  }
  if (startButton) {
    startButton.textContent = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE ? "Restart" : "Start";
  }
  if (pauseButton) {
    pauseButton.style.display = (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE || gameState === STATE.PAUSED) ? "block" : "none";
    pauseButton.textContent = gameState === STATE.PAUSED ? "Resume" : "Pause";
  }
}

// Input handlers
function handleSpace() {
  if (gameState === STATE.TITLE || gameState === STATE.GAMEOVER || gameState === STATE.WIN) {
    startGame();
  } else if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
    gameState = STATE.PAUSED;
    updateUI();
  } else if (gameState === STATE.PAUSED) {
    gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
    updateUI();
  }
}

function handleStart() {
  startGame();
}

function handlePause() {
  if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
    gameState = STATE.PAUSED;
    updateUI();
  } else if (gameState === STATE.PAUSED) {
    gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
    updateUI();
  }
}

const joystickState = setupInput(joystickLeft, joystickRight, {
  onSpace: handleSpace,
  startButton,
  onStart: handleStart,
  pauseButton,
  onPause: handlePause,
});

// Update functions
function updateTrail(dt) {
  unicornTrail = unicornTrail
    .map(p => ({ ...p, life: p.life - dt }))
    .filter(p => p.life > 0);
}

function updateStars(dt) {
  unicornStars = unicornStars
    .map(p => ({
      ...p,
      life: p.life - dt,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
    }))
    .filter(p => p.life > 0);
}

function updateSwitches(dt) {
  for (const sw of switches) {
    if (!sw.pending) continue;
    sw.timer -= dt;
    if (sw.timer <= 0) {
      sw.pending = false;
      sw.mode = sw.mode === "vertical" ? "horizontal" : "vertical";
    }
  }
}

function updateFloatTexts(dt) {
  floatTexts = floatTexts
    .map(t => ({
      ...t,
      life: t.life - dt,
      y: t.y - 30 * dt
    }))
    .filter(t => t.life > 0);
}

function updateDots() {
  const { row, col } = pixelToGrid(player.x, player.y);
  const id = `${row},${col}`;
  if (dots.has(id)) {
    dots.delete(id);
    score += 1;
    updateUI();
    if (dots.size === 0) {
      // Level complete: advance to next or win
      if (currentLevelIndex < levels.length - 1) {
        loadLevel(currentLevelIndex + 1, { resetScore: false, showIntro: true });
      } else {
        gameState = STATE.WIN;
        updateUI();
      }
    }
  }
}

function updateGem(dt) {
  // Enforce a maximum of 5 gems per run
  if (gemsCollected >= 5) return;

  if (gemCooldown > 0) {
    gemCooldown -= dt * 1000;
    if (gemCooldown <= 0) {
      const newGem = placeGem(dots);
      if (newGem) {
        gem = newGem;
      }
    }
  }
  if (gemCooldown > 0) return;
  if (rectanglesOverlap(player, gem)) {
    invincibleTimer = INVINCIBLE_SECONDS;
    gameState = STATE.PLAYING_INVINCIBLE;
    unicornTagged = false;
    score += 5;
    gemsCollected += 1;
    gemCooldown = GEM_RESPAWN_MS;
    // Immediately choose a direction that moves the unicorn away from the player
    chooseAvoidDirection(unicorn, player, maze);
    updateUI();
  }
}

// State management
function startGame() {
  const hasDebugLevel = typeof DEBUG_START_LEVEL === "number";
  const clamped = hasDebugLevel
    ? Math.max(0, Math.min(levels.length - 1, DEBUG_START_LEVEL))
    : 0;
  loadLevel(clamped, { resetScore: true, showIntro: true });
}

// Main game loop
let lastTime = performance.now();
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  if (levelIntroTimer > 0) {
    levelIntroTimer -= dt;
    if (levelIntroTimer < 0) levelIntroTimer = 0;
  }

  const playing = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE;

  if (playing && levelIntroTimer <= 0 && gameState !== STATE.PAUSED) {
    // Track player tile for switch entry detection
    const currentTile = pixelToGrid(player.x, player.y);
    if (
      currentTile.row !== lastPlayerTileRow ||
      currentTile.col !== lastPlayerTileCol
    ) {
      const currentTileCode = tileAt(maze, currentTile.row, currentTile.col);
      if (currentTileCode === 7) {
        const sw = getSwitchAt(currentTile.row, currentTile.col);
        if (sw) {
          if (!sw.pending) {
            sw.pending = true;
            sw.timer = 2; // seconds
          }
        }
      }
      lastPlayerTileRow = currentTile.row;
      lastPlayerTileCol = currentTile.col;
    }

    updatePlayer(dt, player, maze, switches, portals, keys, joystickState, getSwitchAt);
    
    // Use ref objects for mutable values
    const unicornRespawnPauseRef = { value: unicornRespawnPause };
    const randomStepsLeftRef = { value: randomStepsLeft };
    
    const unicornResult = updateUnicorn(
      dt,
      unicorn,
      player,
      maze,
      switches,
      portals,
      gameState,
      unicornRespawnPauseRef,
      randomStepsLeftRef,
      unicornTrail,
      unicornStars,
      invincibleTimer,
      getSwitchAt
    );
    
    // Update refs back to main state
    unicornRespawnPause = unicornRespawnPauseRef.value;
    randomStepsLeft = randomStepsLeftRef.value;
    
    if (unicornResult && unicornResult.newStars) {
      unicornStars.push(...unicornResult.newStars);
    }
    
    updateTrail(dt);
    updateStars(dt);
    updateFloatTexts(dt);
    updateSwitches(dt);
    updateDots();
    updateGem(dt);
    
    if (invincibleTimer > 0) {
      invincibleTimer -= dt;
      if (invincibleTimer <= 0) {
        gameState = STATE.PLAYING_NORMAL;
        updateUI();
      }
    }

    // No collision effects while unicorn is in respawn pause; it's effectively not there
    if (unicornRespawnPause <= 0 && rectanglesOverlap(player, unicorn)) {
      if (gameState === STATE.PLAYING_INVINCIBLE) {
        // Tag unicorn once per invincibility window
        if (!unicornTagged) {
          unicornTagged = true;
          score += 10;
          floatTexts.push({ x: unicorn.x, y: unicorn.y - 10, text: "+10", life: 0.8, maxLife: 0.8 });

          // Respawn unicorn at maze center and end invincibility
          const centerGrid = { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2) };
          const centerPos = gridToPixel(centerGrid.col, centerGrid.row);
          unicorn.x = centerPos.x;
          unicorn.y = centerPos.y;
          unicorn.dirX = 0;
          unicorn.dirY = 0;

          invincibleTimer = 0;
          unicornRespawnPause = 3; // seconds of pause before moving again
          gameState = STATE.PLAYING_NORMAL;
          updateUI();
        }
      } else {
        gameState = STATE.GAMEOVER;
        updateUI();
      }
    }
  }

  draw(
    ctx,
    maze,
    portals,
    switches,
    dots,
    gem,
    gemCooldown,
    unicornTrail,
    unicornStars,
    floatTexts,
    player,
    unicorn,
    gameState,
    levelIntroTimer,
    levelIntroText,
    unicornRespawnPause,
    invincibleTimer,
    getSwitchAt
  );
  
  requestAnimationFrame(loop);
}

// Initialize
const initialSpawns = { player: { row: 1, col: 1 }, unicorn: { row: 13, col: 19 } };
const entities = resetEntities(initialSpawns);
player = entities.player;
unicorn = entities.unicorn;
updateUI();

// Auto-start first run; restart via button/space still works
startGame();
requestAnimationFrame(loop);
