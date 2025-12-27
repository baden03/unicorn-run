// v1.3.0 - Main game orchestrator

import {
  DEBUG_START_LEVEL,
  CANVAS_W,
  CANVAS_H,
  TILE,
  ROWS,
  COLS,
  INVINCIBLE_SECONDS,
  GEM_RESPAWN_DELAY_AFTER_INVINCIBLE,
  STATE,
  MOVEMENT_DEBUG,
  DEBUG_ROWS,
  DEBUG_COLS,
  DEBUG_PLAYER,
  DEBUG_UNICORN,
  DEBUG_PORTALS,
  DEBUG_BRIDGES,
  DEBUG_SWITCHES,
  INITIAL_LIVES,
  EXTRA_LIFE_SCORE_MILESTONE,
} from './config.js';

import { pixelToGrid, gridToPixel, rectanglesOverlap, tileAt, isPortal, getTileMetadata, tileExistsOnLayer, blocked } from './utils.js';
import { createMazeForLevel } from './maze.js';
import { levels, showLevelIntro } from './levels.js';
import { resetEntities, seedDotsFromMaze, placeGem } from './entities.js';
import { keys, setupInput } from './input.js';
import { updatePlayer } from './movement.js';
import { updateUnicorn, chooseAvoidDirection } from './ai.js';
import { draw } from './rendering.js';
import { storage } from './storage.js';
import { checkQualifiesForHighScore, addHighScore, displayHighScores, initHighScoreEntry, getFastestTimeForLevel, formatTime } from './highscores.js';

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
const debugHud = document.getElementById("debugHud");
const highScoreContainer = document.getElementById("highScoreContainer");

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Game state
let currentLevelIndex = 0;
let maze = [];
let portals = [];
let switches = [];
let gameState = STATE.TITLE;
let score = 0;
let lives = INITIAL_LIVES;
let lastExtraLifeScore = 0;
let invincibleTimer = 0;
let gemRespawnDelayAfterInvincible = 0; // Timer for delay after invincibility ends
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
let pauseReason = null; // "manual" or "life_lost" - tracks why game is paused

// v1.3: Timing state
let levelStartTime = 0;
let perLevelTimes = [];
let totalRunTime = 0;
let deaths = 0;

// v1.3: High scores
let highScores = [];

// v1.3: Multiple unicorns support
let player = {};
let unicorns = [];
let dots = new Set();
let gem = { x: 0, y: 0, w: 18, h: 18 };

// Helper function to get switch at position
function getSwitchAt(row, col) {
  return switches.find((s) => s.row === row && s.col === col) || null;
}

// Level management
function loadLevel(index, options = {}) {
  const { resetScore = false, showIntro = true, resetLives = false, resetTiming = false } = options;
  currentLevelIndex = index;
  
  // v1.3: Track level start time for timing
  if (resetTiming) {
    levelStartTime = performance.now();
    perLevelTimes = [];
    totalRunTime = 0;
    deaths = 0;
  } else if (index > 0) {
    // Calculate time for previous level
    const previousLevelTime = performance.now() - levelStartTime;
    perLevelTimes.push(previousLevelTime);
    totalRunTime += previousLevelTime;
    // Start new level timing
    levelStartTime = performance.now();
  } else {
    // First level
    levelStartTime = performance.now();
  }
  
  // In debug mode, use a dummy level config
  const level = MOVEMENT_DEBUG ? { type: "debug" } : levels[currentLevelIndex];
  const { maze: newMaze, portals: newPortals, switches: newSwitches, spawns } =
    createMazeForLevel(level);
  maze = newMaze;
  portals = newPortals;
  switches = newSwitches;
  
  const entities = resetEntities(spawns);
  player = entities.player;
  
  // v1.3: Support multiple unicorns
  if (MOVEMENT_DEBUG === "bridges" || MOVEMENT_DEBUG === "switches") {
    unicorns = [];
  } else if (MOVEMENT_DEBUG === "unicorn_ai") {
    unicorns = entities.unicorn ? [entities.unicorn] : [];
  } else {
    unicorns = entities.unicorns || (entities.unicorn ? [entities.unicorn] : []);
  }
  
  dots = seedDotsFromMaze(maze, level, spawns);
  // Skip gem placement in bridges and switches debug modes
  if (MOVEMENT_DEBUG !== "bridges" && MOVEMENT_DEBUG !== "switches") {
    const newGem = placeGem(dots);
    if (newGem) {
      gem = newGem;
    }
  }
  
  if (resetScore) {
    score = 0;
    lastExtraLifeScore = 0;
  }
  if (resetLives) {
    lives = INITIAL_LIVES;
  }
  
  // Skip intro in debug modes
  if (showIntro && !MOVEMENT_DEBUG) {
    const intro = showLevelIntro(currentLevelIndex);
    levelIntroText = intro.text;
    levelIntroTimer = intro.timer;
  } else {
    levelIntroText = "";
    levelIntroTimer = 0;
  }
  
  gameState = STATE.PLAYING_NORMAL;
  invincibleTimer = 0;
  gemRespawnDelayAfterInvincible = 0; // Reset gem respawn delay
  randomStepsLeft = 0;
  unicornTrail = [];
  unicornStars = [];
  unicornTagged = false;
  floatTexts = [];
  unicornRespawnPause = 0;
  gemsCollected = 0;
  lastPlayerTileRow = null;
  lastPlayerTileCol = null;
  pauseReason = null; // Clear pause reason on level load
  
  // Reset unicorn respawn pauses
  unicorns.forEach(u => {
    if (u) u.respawnPause = 0;
  });
  
  updateUI();
}

function updateUI() {
  scoreEl.textContent = `Score: ${score}`;
  
  // v1.3: Display lives
  const livesElElement = document.getElementById("lives");
  if (livesElElement) {
    livesElElement.textContent = `Lives: ${lives}`;
  }
  
  // v1.3: Show fastest time for advanced levels
  if (levelEl) {
    let levelText = `Level: ${currentLevelIndex + 1} / ${levels.length}`;
    if (currentLevelIndex > 0 && highScores.length > 0) {
      const fastest = getFastestTimeForLevel(currentLevelIndex, highScores);
      if (fastest) {
        levelText += ` | Best: ${fastest.name} (${formatTime(fastest.time)})`;
      }
    }
    levelEl.textContent = levelText;
  }
  
  // Build state text with special handling for pause reasons
  let statusText = "";
  if (gameState === STATE.PAUSED) {
    if (pauseReason === "life_lost") {
      statusText = `Life Lost! ${lives} ${lives === 1 ? 'life' : 'lives'} remaining - Press Space or Resume to continue`;
    } else {
      statusText = "Paused - Press Space or Resume";
    }
  } else {
    const stateText = {
      [STATE.TITLE]: "Press Space or Start",
      [STATE.PLAYING_NORMAL]: "Collect dots + gems!",
      [STATE.PLAYING_INVINCIBLE]: "Invincible! Avoid walls.",
      [STATE.GAMEOVER]: "Game Over - press Space or Start",
      [STATE.WIN]: "You win! Press Space or Start",
      [STATE.ENTER_HIGH_SCORE]: "Enter your name",
      [STATE.SHOW_HIGH_SCORES]: "High Scores",
    };
    statusText = stateText[gameState] || "";
  }
  statusEl.textContent = statusText;
  
  if (startButton) {
    startButton.textContent = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE ? "Restart" : "Start";
    startButton.style.display = (gameState === STATE.ENTER_HIGH_SCORE || gameState === STATE.SHOW_HIGH_SCORES) ? "none" : "block";
  }
  if (pauseButton) {
    pauseButton.style.display = (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE || gameState === STATE.PAUSED) ? "block" : "none";
    pauseButton.textContent = gameState === STATE.PAUSED ? "Resume" : "Pause";
  }
  
  // Show/hide debug HUD based on MOVEMENT_DEBUG
  if (debugHud) {
    debugHud.style.display = MOVEMENT_DEBUG ? "block" : "none";
  }
  
  // Show/hide high score container
  if (highScoreContainer) {
    highScoreContainer.style.display = (gameState === STATE.ENTER_HIGH_SCORE || gameState === STATE.SHOW_HIGH_SCORES) ? "block" : "none";
  }
}

function updateDebugHUD() {
  // Show debug HUD if any debug flag is enabled
  if (!(MOVEMENT_DEBUG || DEBUG_PLAYER || DEBUG_UNICORN || DEBUG_PORTALS || DEBUG_BRIDGES || DEBUG_SWITCHES) || !debugHud) return;
  
  // Show/hide sections based on DEBUG flags
  const showSection = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "block" : "none";
  };
  
  showSection("debugSectionPlayerPos", DEBUG_PLAYER);
  showSection("debugSectionPlayerDir", DEBUG_PLAYER);
  showSection("debugSectionPlayerDesired", DEBUG_PLAYER);
  showSection("debugSectionPlayerSpeed", DEBUG_PLAYER);
  showSection("debugSectionCurrentTile", DEBUG_PLAYER);
  showSection("debugSectionNeighbors", DEBUG_PLAYER);
  showSection("debugSectionGridInfo", DEBUG_PLAYER);
  showSection("debugSectionCollisionCorners", DEBUG_PLAYER);
  showSection("debugSectionMovementStart", DEBUG_PLAYER);
  showSection("debugSectionPortal", DEBUG_PORTALS);
  showSection("debugSectionBridgeTunnel", DEBUG_BRIDGES);
  showSection("debugSectionSwitch", DEBUG_SWITCHES);
  showSection("debugSectionUnicorn", DEBUG_UNICORN);
  showSection("debugSectionGameState", DEBUG_PLAYER);
  showSection("debugSectionCollision", DEBUG_PLAYER);
  
  const grid = pixelToGrid(player.x, player.y);
  const currentTileCode = tileAt(maze, grid.row, grid.col);
  const tileNames = {
    0: "Floor",
    1: "Wall",
    5: "Portal",
    6: "Bridge",
    7: "Switch",
    8: "Tunnel"
  };
  
  // Portal info
  let portalInfo = "None";
  if (isPortal(maze, grid.row, grid.col)) {
    const pair = portals.find(
      (p) =>
        (p.a.row === grid.row && p.a.col === grid.col) ||
        (p.b.row === grid.row && p.b.col === grid.col)
    );
    if (pair) {
      const target = (pair.a.row === grid.row && pair.a.col === grid.col) ? pair.b : pair.a;
      portalInfo = `→ (${target.row},${target.col})`;
    }
  }
  
  // Neighbor tiles
  const neighbors = {
    up: tileAt(maze, grid.row - 1, grid.col),
    down: tileAt(maze, grid.row + 1, grid.col),
    left: tileAt(maze, grid.row, grid.col - 1),
    right: tileAt(maze, grid.row, grid.col + 1)
  };
  
  // Format direction
  const dirStr = (x, y) => {
    if (x === -1) return "LEFT";
    if (x === 1) return "RIGHT";
    if (y === -1) return "UP";
    if (y === 1) return "DOWN";
    return "NONE";
  };
  
  // Update DOM elements
  const playerPosEl = document.getElementById("debugPlayerPos");
  const playerDirEl = document.getElementById("debugPlayerDir");
  const playerDesiredEl = document.getElementById("debugPlayerDesired");
  const playerSpeedEl = document.getElementById("debugPlayerSpeed");
  const currentTileEl = document.getElementById("debugCurrentTile");
  const portalInfoEl = document.getElementById("debugPortalInfo");
  const neighborsEl = document.getElementById("debugNeighbors");
  const gridInfoEl = document.getElementById("debugGridInfo");
  const bridgeTunnelEl = document.getElementById("debugBridgeTunnel");
  const collisionCornersEl = document.getElementById("debugCollisionCorners");
  const movementStartEl = document.getElementById("debugMovementStart");
  const switchDebugEl = document.getElementById("debugSwitch");
  const unicornDebugEl = document.getElementById("debugUnicorn");
  
  // DEBUG_PLAYER sections
  if (DEBUG_PLAYER) {
    if (playerPosEl) {
      playerPosEl.innerHTML = `Pixel: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})<br>Grid: (${grid.row}, ${grid.col})`;
    }
    
    if (playerDirEl) {
      playerDirEl.innerHTML = `(${player.dirX}, ${player.dirY})<br>[${dirStr(player.dirX, player.dirY)}]`;
    }
    
    if (playerDesiredEl) {
      playerDesiredEl.innerHTML = `(${player.desiredX}, ${player.desiredY})<br>[${dirStr(player.desiredX, player.desiredY)}]`;
    }
    
    if (playerSpeedEl) {
      const layerName = player.layer === 1 ? "Tunnel (1)" : "Floor (2)";
      playerSpeedEl.innerHTML = `Speed: ${player.speed.toFixed(1)}<br>Layer: ${player.layer} [${layerName}]`;
    }
    
    if (currentTileEl) {
      currentTileEl.innerHTML = `Code: ${currentTileCode}<br>Type: ${tileNames[currentTileCode] || "Unknown"}`;
    }
    
    if (neighborsEl) {
      neighborsEl.innerHTML = `Up: ${neighbors.up} [${tileNames[neighbors.up] || "Wall"}]<br>` +
                              `Down: ${neighbors.down} [${tileNames[neighbors.down] || "Wall"}]<br>` +
                              `Left: ${neighbors.left} [${tileNames[neighbors.left] || "Wall"}]<br>` +
                              `Right: ${neighbors.right} [${tileNames[neighbors.right] || "Wall"}]`;
    }
    
    if (gridInfoEl) {
      gridInfoEl.innerHTML = `Size: ${DEBUG_ROWS}×${DEBUG_COLS}<br>Tile Size: ${TILE}px`;
    }
  }
  
  // DEBUG_PORTALS section
  if (DEBUG_PORTALS && portalInfoEl) {
    portalInfoEl.textContent = portalInfo;
  }
  
  // DEBUG_BRIDGES section
  if (DEBUG_BRIDGES && bridgeTunnelEl) {
    const isOnBridge = currentTileCode === 6;
    const isOnTunnel = currentTileCode === 8;
    const metadata = getTileMetadata(maze, grid.row, grid.col);
    let info = `On Bridge: ${isOnBridge}<br>On Tunnel: ${isOnTunnel}<br>`;
    info += `Tile Layer: ${metadata.layer}<br>Player Layer: ${player.layer}`;
    if (isOnBridge) {
      const upTile = tileAt(maze, grid.row - 1, grid.col);
      const downTile = tileAt(maze, grid.row + 1, grid.col);
      const leftTile = tileAt(maze, grid.row, grid.col - 1);
      const rightTile = tileAt(maze, grid.row, grid.col + 1);
      const isVertical = (leftTile === 8 || rightTile === 8);
      const isHorizontal = (upTile === 8 || downTile === 8);
      info += `<br>Bridge Type: ${isVertical ? 'Vertical' : isHorizontal ? 'Horizontal' : 'Unknown'}`;
    }
    if (isOnTunnel) {
      const upTile = tileAt(maze, grid.row - 1, grid.col);
      const downTile = tileAt(maze, grid.row + 1, grid.col);
      const leftTile = tileAt(maze, grid.row, grid.col - 1);
      const rightTile = tileAt(maze, grid.row, grid.col + 1);
      const isHorizontal = (leftTile === 8 || rightTile === 8);
      const isVertical = (upTile === 8 || downTile === 8);
      info += `<br>Tunnel Type: ${isHorizontal ? 'Horizontal' : isVertical ? 'Vertical' : 'Unknown'}`;
    }
    bridgeTunnelEl.innerHTML = info;
  }
  
  // DEBUG_PLAYER: Collision corners debug
  if (DEBUG_PLAYER && collisionCornersEl) {
    const corners = [
      { x: player.x - player.w / 2, y: player.y - player.h / 2, name: "TL" },
      { x: player.x + player.w / 2, y: player.y - player.h / 2, name: "TR" },
      { x: player.x - player.w / 2, y: player.y + player.h / 2, name: "BL" },
      { x: player.x + player.w / 2, y: player.y + player.h / 2, name: "BR" },
    ];
    let cornerInfo = "";
    for (const corner of corners) {
      const cornerGrid = pixelToGrid(corner.x, corner.y);
      const cornerTile = tileAt(maze, cornerGrid.row, cornerGrid.col);
      const cornerMetadata = getTileMetadata(maze, cornerGrid.row, cornerGrid.col);
      const existsOnLayer = tileExistsOnLayer(maze, cornerGrid.row, cornerGrid.col, player.layer);
      cornerInfo += `${corner.name}: (${cornerGrid.row},${cornerGrid.col})<br>`;
      cornerInfo += `&nbsp;&nbsp;Tile: ${cornerTile} [${tileNames[cornerTile] || "Wall"}]<br>`;
      cornerInfo += `&nbsp;&nbsp;Tile Layer: ${cornerMetadata.layer}<br>`;
      cornerInfo += `&nbsp;&nbsp;Exists on Player Layer (${player.layer}): ${existsOnLayer}<br>`;
      if (cornerTile === 6) {
        cornerInfo += `&nbsp;&nbsp;→ Bridge (should not block layer 1)<br>`;
      }
      cornerInfo += `<br>`;
    }
    
    // Show what would happen if moving in desired direction (even if not currently moving)
    if (player.desiredX !== 0 || player.desiredY !== 0) {
      const moveDist = TILE; // One tile distance
      const futureX = player.x + (player.desiredX * moveDist);
      const futureY = player.y + (player.desiredY * moveDist);
      const futureTile = pixelToGrid(futureX, futureY);
      const futureCode = tileAt(maze, futureTile.row, futureTile.col);
      let futureTargetLayer = player.layer;
      if (player.layer === 2 && futureCode === 8) futureTargetLayer = 1;
      else if (player.layer === 1 && futureCode === 0) futureTargetLayer = 2;
      // Bridges don't cause layer transitions - stay on current layer
      
      cornerInfo += `<strong>Desired Move ${dirStr(player.desiredX, player.desiredY)}:</strong><br>`;
      cornerInfo += `Target: (${futureTile.row},${futureTile.col})<br>`;
      cornerInfo += `Target Tile: ${futureCode} [${tileNames[futureCode] || "Wall"}]<br>`;
      cornerInfo += `Target Layer: ${futureTargetLayer}<br>`;
      const wouldBlock = blocked(maze, futureX, futureY, player.w, player.h, player.layer, futureTargetLayer);
      cornerInfo += `Would Block (wall): ${wouldBlock}<br>`;
      
      // Check switch blocking
      let switchWouldBlock = false;
      let switchBlockReason = "";
      if (futureCode === 7) {
        const sw = getSwitchAt(futureTile.row, futureTile.col);
        if (sw) {
          switchBlockReason = `Switch mode=${sw.mode}`;
          if (sw.mode === "vertical" && player.desiredX !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks horizontal (desiredX=${player.desiredX})`;
          } else if (sw.mode === "horizontal" && player.desiredY !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks vertical (desiredY=${player.desiredY})`;
          } else {
            switchBlockReason += ` does not block (desired=(${player.desiredX},${player.desiredY}))`;
          }
        }
      }
      if (futureCode === 7) {
        cornerInfo += `Switch blocking: ${switchBlockReason}<br>`;
        cornerInfo += `Would Block (switch): ${switchWouldBlock}<br>`;
        cornerInfo += `Final Would Block: ${wouldBlock || switchWouldBlock}<br>`;
      }
      
      // Check each corner of the future position
      const futureCorners = [
        { x: futureX - player.w / 2, y: futureY - player.h / 2, name: "FTL" },
        { x: futureX + player.w / 2, y: futureY - player.h / 2, name: "FTR" },
        { x: futureX - player.w / 2, y: futureY + player.h / 2, name: "FBL" },
        { x: futureX + player.w / 2, y: futureY + player.h / 2, name: "FBR" },
      ];
      for (const fCorner of futureCorners) {
        const fCornerGrid = pixelToGrid(fCorner.x, fCorner.y);
        const fCornerTile = tileAt(maze, fCornerGrid.row, fCornerGrid.col);
        const fExistsOnLayer = tileExistsOnLayer(maze, fCornerGrid.row, fCornerGrid.col, futureTargetLayer);
        cornerInfo += `&nbsp;${fCorner.name}: (${fCornerGrid.row},${fCornerGrid.col}) tile=${fCornerTile} exists=${fExistsOnLayer}`;
        if (fCornerTile === 6 && futureTargetLayer === 1) {
          cornerInfo += ` [BRIDGE - should allow]`;
        }
        cornerInfo += `<br>`;
      }
    }
    
    collisionCornersEl.innerHTML = cornerInfo;
  }
  
  // DEBUG_PLAYER: Turn logic debug
  if (DEBUG_PLAYER && movementStartEl) {
    const center = gridToPixel(grid.col, grid.row);
    const turnSnap = TILE * 0.3;
    const nearCenter = Math.abs(player.x - center.x) < turnSnap && Math.abs(player.y - center.y) < turnSnap;
    const wantsTurn = (player.desiredX !== player.dirX || player.desiredY !== player.dirY);
    
    if (nearCenter && (player.desiredX !== 0 || player.desiredY !== 0) && wantsTurn && (player.dirX !== 0 || player.dirY !== 0)) {
      let turnInfo = `<strong>Turn Attempt:</strong><br>`;
      turnInfo += `Currently moving: ${dirStr(player.dirX, player.dirY)}<br>`;
      turnInfo += `Desired direction: ${dirStr(player.desiredX, player.desiredY)}<br>`;
      turnInfo += `Current tile: ${currentTileCode} [${tileNames[currentTileCode] || "Unknown"}]<br>`;
      
      const testX = center.x + player.desiredX * TILE * 0.4;
      const testY = center.y + player.desiredY * TILE * 0.4;
      const testTile = pixelToGrid(testX, testY);
      const testCode = tileAt(maze, testTile.row, testTile.col);
      let testTargetLayer = player.layer;
      if (player.layer === 2 && testCode === 8) testTargetLayer = 1;
      else if (player.layer === 1 && testCode === 0) testTargetLayer = 2;
      
      turnInfo += `Test position: (${testTile.row},${testTile.col}) tile=${testCode}<br>`;
      
      // Check switch blocking
      let switchWouldBlock = false;
      let switchBlockReason = "";
      if (testCode === 7) {
        const sw = getSwitchAt(testTile.row, testTile.col);
        if (sw) {
          switchBlockReason = `Switch at (${testTile.row},${testTile.col}) mode=${sw.mode}`;
          if (sw.mode === "vertical" && player.desiredX !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks horizontal movement`;
          } else if (sw.mode === "horizontal" && player.desiredY !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks vertical movement`;
          } else {
            switchBlockReason += ` does not block (mode=${sw.mode}, desired=(${player.desiredX},${player.desiredY}))`;
          }
          turnInfo += `Switch blocking: ${switchBlockReason}<br>`;
          turnInfo += `Switch would block: ${switchWouldBlock}<br>`;
        }
      }
      
      const testBlocked = blocked(maze, testX, testY, player.w, player.h, player.layer, testTargetLayer);
      turnInfo += `Test blocked (wall): ${testBlocked}<br>`;
      turnInfo += `Turn allowed: ${!testBlocked && !switchWouldBlock}<br>`;
      turnInfo += `Current dirX: ${player.dirX}, dirY: ${player.dirY}<br>`;
      turnInfo += `Would set dirX to: ${player.desiredX}, dirY to: ${player.desiredY}<br>`;
      
      if (switchWouldBlock) {
        turnInfo += `→ Switch blocking prevented turn<br>`;
        turnInfo += `→ Player should continue in current direction: ${dirStr(player.dirX, player.dirY)}<br>`;
      }
      
      movementStartEl.innerHTML = turnInfo;
      return; // Don't show movement start info if we're showing turn info
    }
  }
  
  // DEBUG_PLAYER: Movement start debug
  if (DEBUG_PLAYER && movementStartEl) {
    let startInfo = "";
    if (player.dirX === 0 && player.dirY === 0 && (player.desiredX !== 0 || player.desiredY !== 0)) {
      startInfo += `Trying to start moving ${dirStr(player.desiredX, player.desiredY)}<br>`;
      startInfo += `Current tile: ${currentTileCode} [${tileNames[currentTileCode] || "Unknown"}]<br>`;
      
      if (currentTileCode === 8) {
        const upTile = tileAt(maze, grid.row - 1, grid.col);
        const downTile = tileAt(maze, grid.row + 1, grid.col);
        const leftTile = tileAt(maze, grid.row, grid.col - 1);
        const rightTile = tileAt(maze, grid.row, grid.col + 1);
        const hasHorizontalPath = (leftTile === 8 || leftTile === 6 || rightTile === 8 || rightTile === 6);
        const hasVerticalPath = (upTile === 8 || upTile === 6 || downTile === 8 || downTile === 6);
        startInfo += `Has Horizontal Path: ${hasHorizontalPath}<br>`;
        startInfo += `Has Vertical Path: ${hasVerticalPath}<br>`;
        startInfo += `Neighbors: L=${leftTile} R=${rightTile} U=${upTile} D=${downTile}<br>`;
        
        const wouldBlockVertical = hasHorizontalPath && !hasVerticalPath && player.desiredY !== 0;
        const wouldBlockHorizontal = hasVerticalPath && !hasHorizontalPath && player.desiredX !== 0;
        startInfo += `Would block vertical: ${wouldBlockVertical}<br>`;
        startInfo += `Would block horizontal: ${wouldBlockHorizontal}<br>`;
      }
      
      const testX = player.x + player.desiredX * TILE * 0.4;
      const testY = player.y + player.desiredY * TILE * 0.4;
      const testTile = pixelToGrid(testX, testY);
      const testCode = tileAt(maze, testTile.row, testTile.col);
      let testTargetLayer = player.layer;
      if (player.layer === 2 && testCode === 8) testTargetLayer = 1;
      else if (player.layer === 1 && testCode === 0) testTargetLayer = 2;
      const testBlocked = blocked(maze, testX, testY, player.w, player.h, player.layer, testTargetLayer);
      
      // Check switch blocking
      let switchWouldBlock = false;
      let switchBlockReason = "";
      if (testCode === 7) {
        const sw = getSwitchAt(testTile.row, testTile.col);
        if (sw) {
          switchBlockReason = `Switch at (${testTile.row},${testTile.col}) mode=${sw.mode}`;
          if (sw.mode === "vertical" && player.desiredX !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks horizontal movement`;
          } else if (sw.mode === "horizontal" && player.desiredY !== 0) {
            switchWouldBlock = true;
            switchBlockReason += ` blocks vertical movement`;
          } else {
            switchBlockReason += ` does not block (mode=${sw.mode}, desired=(${player.desiredX},${player.desiredY}))`;
          }
        } else {
          switchBlockReason = `Switch tile but no switch object found`;
        }
      }
      
      startInfo += `Test position: (${testTile.row},${testTile.col}) tile=${testCode}<br>`;
      startInfo += `Test target layer: ${testTargetLayer}<br>`;
      startInfo += `Test blocked: ${testBlocked}<br>`;
      if (testCode === 7) {
        startInfo += `Switch blocking check: ${switchBlockReason}<br>`;
        startInfo += `Switch would block: ${switchWouldBlock}<br>`;
      }
      startInfo += `<br><strong>After checks:</strong><br>`;
      // Calculate canStart properly
      let calculatedCanStart = true;
      if (currentTileCode === 8) {
        if (hasHorizontalPath && !hasVerticalPath && player.desiredY !== 0) calculatedCanStart = false;
        if (hasVerticalPath && !hasHorizontalPath && player.desiredX !== 0) calculatedCanStart = false;
      }
      startInfo += `canStart calculated: ${calculatedCanStart}<br>`;
      startInfo += `Final canStart: ${calculatedCanStart && !testBlocked && !switchWouldBlock}<br>`;
      if (switchWouldBlock) {
        startInfo += `→ Switch blocking prevented movement start<br>`;
      }
      startInfo += `Current dirX: ${player.dirX}, dirY: ${player.dirY}<br>`;
      startInfo += `Would set dirX to: ${player.desiredX}, dirY to: ${player.desiredY}<br>`;
      startInfo += `<br><strong>Actual Result:</strong><br>`;
      startInfo += `dirX after check: ${player.dirX}, dirY after check: ${player.dirY}<br>`;
      startInfo += `Movement started: ${(player.dirX !== 0 || player.dirY !== 0) ? 'Yes' : 'No'}<br>`;
      
      // Also check what happens during actual movement
      if (calculatedCanStart && !testBlocked) {
        startInfo += `<br><strong>If movement started:</strong><br>`;
        const futureMoveX = player.desiredX * player.speed * (1/60);
        const futureMoveY = player.desiredY * player.speed * (1/60);
        const futureTargetTile = pixelToGrid(player.x + futureMoveX, player.y + futureMoveY);
        const futureTargetCode = tileAt(maze, futureTargetTile.row, futureTargetTile.col);
        
        // Check bridge/tunnel restrictions that would apply during movement
        if (futureTargetCode === 6) {
          const upTile = tileAt(maze, futureTargetTile.row - 1, futureTargetTile.col);
          const downTile = tileAt(maze, futureTargetTile.row + 1, futureTargetTile.col);
          const leftTile = tileAt(maze, futureTargetTile.row, futureTargetTile.col - 1);
          const rightTile = tileAt(maze, futureTargetTile.row, futureTargetTile.col + 1);
          const isVerticalBridge = (leftTile === 8 || rightTile === 8);
          const isHorizontalBridge = (upTile === 8 || downTile === 8);
          startInfo += `Target is bridge: vertical=${isVerticalBridge}, horizontal=${isHorizontalBridge}<br>`;
          if (isVerticalBridge && player.desiredX !== 0) {
            startInfo += `→ Would block horizontal movement on vertical bridge!<br>`;
          }
          if (isHorizontalBridge && player.desiredY !== 0) {
            startInfo += `→ Would block vertical movement on horizontal bridge!<br>`;
          }
        }
      }
    } else {
      startInfo = `Not trying to start<br>`;
      startInfo += `dirX: ${player.dirX}, dirY: ${player.dirY}<br>`;
      startInfo += `desiredX: ${player.desiredX}, desiredY: ${player.desiredY}<br>`;
    }
    movementStartEl.innerHTML = startInfo;
  }
  
  // Also show what happens during movement update
  if (movementStartEl && (player.dirX !== 0 || player.dirY !== 0)) {
    let moveInfo = movementStartEl.innerHTML;
    moveInfo += `<br><strong>During Movement:</strong><br>`;
    const moveX = player.dirX * player.speed * (1/60); // Approximate dt
    const moveY = player.dirY * player.speed * (1/60);
    const targetTile = pixelToGrid(player.x + moveX, player.y + moveY);
    const targetCode = tileAt(maze, targetTile.row, targetTile.col);
    let targetLayer = player.layer;
    if (player.layer === 2 && targetCode === 8) targetLayer = 1;
    else if (player.layer === 1 && targetCode === 0) targetLayer = 2;
    moveInfo += `Moving: (${player.dirX}, ${player.dirY})<br>`;
    moveInfo += `Target tile: (${targetTile.row},${targetTile.col}) code=${targetCode}<br>`;
    moveInfo += `Target layer: ${targetLayer}<br>`;
    const wouldBlockX = blocked(maze, player.x + moveX, player.y, player.w, player.h, player.layer, targetLayer);
    const wouldBlockY = blocked(maze, player.x, player.y + moveY, player.w, player.h, player.layer, targetLayer);
    moveInfo += `Would block X: ${wouldBlockX}<br>`;
    moveInfo += `Would block Y: ${wouldBlockY}<br>`;
    movementStartEl.innerHTML = moveInfo;
  }
  
  // DEBUG_SWITCHES: Switch debug info
  if (DEBUG_SWITCHES && switchDebugEl) {
    let switchInfo = "";
    
    // Check if player is on a switch
    const currentSwitch = getSwitchAt(grid.row, grid.col);
    if (currentSwitch) {
      switchInfo += `<strong>On Switch:</strong><br>`;
      switchInfo += `Position: (${currentSwitch.row},${currentSwitch.col})<br>`;
      switchInfo += `Mode: ${currentSwitch.mode}<br>`;
      switchInfo += `Pending: ${currentSwitch.pending ? 'Yes' : 'No'}<br>`;
      if (currentSwitch.pending) {
        switchInfo += `Timer: ${currentSwitch.timer.toFixed(2)}s<br>`;
        switchInfo += `Next Mode: ${currentSwitch.mode === "vertical" ? "horizontal" : "vertical"}<br>`;
      }
      switchInfo += `<br>`;
      
      // Show which walls are blocked
      if (currentSwitch.mode === "vertical") {
        switchInfo += `<strong>Blocked Walls:</strong><br>`;
        switchInfo += `Left: BLOCKED<br>`;
        switchInfo += `Right: BLOCKED<br>`;
        switchInfo += `Top: Open<br>`;
        switchInfo += `Bottom: Open<br>`;
      } else {
        switchInfo += `<strong>Blocked Walls:</strong><br>`;
        switchInfo += `Left: Open<br>`;
        switchInfo += `Right: Open<br>`;
        switchInfo += `Top: BLOCKED<br>`;
        switchInfo += `Bottom: BLOCKED<br>`;
      }
      switchInfo += `<br>`;
      
      // Show movement restrictions
      switchInfo += `<strong>Movement Allowed:</strong><br>`;
      if (currentSwitch.mode === "vertical") {
        switchInfo += `Up/Down: ✓ Allowed<br>`;
        switchInfo += `Left/Right: ✗ Blocked<br>`;
      } else {
        switchInfo += `Up/Down: ✗ Blocked<br>`;
        switchInfo += `Left/Right: ✓ Allowed<br>`;
      }
    } else {
      switchInfo += `Not on a switch<br>`;
      
      // Check if approaching a switch
      if (player.dirX !== 0 || player.dirY !== 0) {
        const futureX = player.x + (player.dirX * TILE);
        const futureY = player.y + (player.dirY * TILE);
        const futureGrid = pixelToGrid(futureX, futureY);
        const futureSwitch = getSwitchAt(futureGrid.row, futureGrid.col);
        if (futureSwitch) {
          switchInfo += `<br><strong>Approaching Switch:</strong><br>`;
          switchInfo += `Position: (${futureSwitch.row},${futureSwitch.col})<br>`;
          switchInfo += `Mode: ${futureSwitch.mode}<br>`;
          switchInfo += `Pending: ${futureSwitch.pending ? 'Yes' : 'No'}<br>`;
          if (futureSwitch.pending) {
            switchInfo += `Timer: ${futureSwitch.timer.toFixed(2)}s<br>`;
          }
          switchInfo += `<br>`;
          
          // Show if movement would be blocked
          const wouldBlock = (futureSwitch.mode === "vertical" && player.dirX !== 0) ||
                            (futureSwitch.mode === "horizontal" && player.dirY !== 0);
          switchInfo += `Would Block: ${wouldBlock ? 'Yes' : 'No'}<br>`;
        }
      }
    }
    
    // Show all switches in the maze
    if (switches && switches.length > 0) {
      switchInfo += `<br><strong>All Switches:</strong><br>`;
      switches.forEach((sw, idx) => {
        switchInfo += `${idx + 1}. (${sw.row},${sw.col}) `;
        switchInfo += `mode=${sw.mode} `;
        switchInfo += `pending=${sw.pending ? 'Y' : 'N'}`;
        if (sw.pending) {
          switchInfo += ` timer=${sw.timer.toFixed(1)}s`;
        }
        switchInfo += `<br>`;
      });
    }
    
    // Show what happens during movement update
    if (player.dirX !== 0 || player.dirY !== 0) {
      const moveX = player.dirX * player.speed * (1/60);
      const moveY = player.dirY * player.speed * (1/60);
      const futureTargetTile = pixelToGrid(player.x + moveX, player.y + moveY);
      const futureTargetCode = tileAt(maze, futureTargetTile.row, futureTargetTile.col);
      
      switchInfo += `<br><strong>During Movement Update:</strong><br>`;
      switchInfo += `Currently moving: (${player.dirX}, ${player.dirY})<br>`;
      switchInfo += `Desired direction: (${player.desiredX}, ${player.desiredY})<br>`;
      switchInfo += `Target tile: (${futureTargetTile.row},${futureTargetTile.col}) code=${futureTargetCode}<br>`;
      
      if (futureTargetCode === 7) {
        const sw = getSwitchAt(futureTargetTile.row, futureTargetTile.col);
        if (sw) {
          switchInfo += `Switch mode: ${sw.mode}<br>`;
          const wouldBlockX = (sw.mode === "vertical" && moveX !== 0);
          const wouldBlockY = (sw.mode === "horizontal" && moveY !== 0);
          switchInfo += `Would block X: ${wouldBlockX} (moveX=${moveX.toFixed(2)})<br>`;
          switchInfo += `Would block Y: ${wouldBlockY} (moveY=${moveY.toFixed(2)})<br>`;
          switchInfo += `Movement prevented: ${wouldBlockX || wouldBlockY}<br>`;
          
          // Show what happens to each axis
          if (wouldBlockX) {
            switchInfo += `→ X movement blocked: player.dirX will be set to 0<br>`;
            switchInfo += `→ Player will ${moveY !== 0 ? 'continue' : 'stop'} moving in Y direction (${moveY !== 0 ? 'dirY=' + player.dirY : 'dirY=0'})<br>`;
          }
          if (wouldBlockY) {
            switchInfo += `→ Y movement blocked: player.dirY will be set to 0<br>`;
            switchInfo += `→ Player will ${moveX !== 0 ? 'continue' : 'stop'} moving in X direction (${moveX !== 0 ? 'dirX=' + player.dirX : 'dirX=0'})<br>`;
          }
          
          // Show the key insight: if moving in a non-blocked direction, player should continue
          if (sw.mode === "vertical") {
            // Vertical switch blocks horizontal movement
            if (moveX !== 0 && moveY === 0) {
              switchInfo += `→ Player is moving horizontally, switch blocks horizontal → Player will STOP<br>`;
            } else if (moveX === 0 && moveY !== 0) {
              switchInfo += `→ Player is moving vertically, switch does NOT block vertical → Player will CONTINUE<br>`;
            } else if (moveX !== 0 && moveY !== 0) {
              switchInfo += `→ Player is moving diagonally, X blocked but Y not blocked → Player will continue in Y direction<br>`;
            }
          } else if (sw.mode === "horizontal") {
            // Horizontal switch blocks vertical movement
            if (moveY !== 0 && moveX === 0) {
              switchInfo += `→ Player is moving vertically, switch blocks vertical → Player will STOP<br>`;
            } else if (moveY === 0 && moveX !== 0) {
              switchInfo += `→ Player is moving horizontally, switch does NOT block horizontal → Player will CONTINUE<br>`;
            } else if (moveX !== 0 && moveY !== 0) {
              switchInfo += `→ Player is moving diagonally, Y blocked but X not blocked → Player will continue in X direction<br>`;
            }
          }
        }
      }
    } else {
      switchInfo += `<br><strong>Player is stopped:</strong><br>`;
      switchInfo += `Current direction: (${player.dirX}, ${player.dirY})<br>`;
      switchInfo += `Desired direction: (${player.desiredX}, ${player.desiredY})<br>`;
      switchInfo += `(Try to start moving logic is shown above in "Movement Start Check")<br>`;
    }
    
    switchDebugEl.innerHTML = switchInfo;
  }
  
  // DEBUG_UNICORN: Unicorn debug info (v1.3: support multiple unicorns)
  if (DEBUG_UNICORN && unicornDebugEl) {
    if (unicorns.length === 0) {
      unicornDebugEl.innerHTML = "No unicorns spawned";
    } else {
      let unicornInfo = `<strong>Unicorns (${unicorns.length}):</strong><br><br>`;
      unicorns.forEach((unicorn, index) => {
        if (!unicorn) return;
        const unicornGrid = pixelToGrid(unicorn.x, unicorn.y);
        const unicornTileCode = tileAt(maze, unicornGrid.row, unicornGrid.col);
        
        unicornInfo += `<strong>Unicorn ${index + 1}:</strong><br>`;
        unicornInfo += `Position: (${unicorn.x.toFixed(1)}, ${unicorn.y.toFixed(1)}) Grid: (${unicornGrid.row}, ${unicornGrid.col})<br>`;
        unicornInfo += `Direction: (${unicorn.dirX}, ${unicorn.dirY}) [${dirStr(unicorn.dirX, unicorn.dirY)}]<br>`;
        unicornInfo += `Speed: ${unicorn.speed.toFixed(1)}<br>`;
        unicornInfo += `Layer: ${unicorn.layer} [${unicorn.layer === 1 ? "Tunnel (1)" : "Floor (2)"}]<br>`;
        unicornInfo += `Tile: ${unicornTileCode} [${tileNames[unicornTileCode] || "Unknown"}]<br>`;
        
        // Distance to player
        const dx = player.x - unicorn.x;
        const dy = player.y - unicorn.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        unicornInfo += `Distance to Player: ${dist.toFixed(1)}px (Δ${dx.toFixed(1)}, ${dy.toFixed(1)})<br>`;
        
        // AI state (if available)
        if (unicorn.definition) {
          unicornInfo += `Type: ${unicorn.definition.name || "classic"}<br>`;
          unicornInfo += `Chase Bias: ${unicorn.definition.behavior?.chaseBias || "N/A"}<br>`;
          unicornInfo += `Random Bias: ${unicorn.definition.behavior?.randomBias || "N/A"}<br>`;
        }
        unicornInfo += `<br>`;
      });
      
      unicornDebugEl.innerHTML = unicornInfo;
    }
  }
  
  // DEBUG_PLAYER: Game State & Lives debug
  if (DEBUG_PLAYER) {
    // Define stateNames at function scope so it can be used in multiple sections
    const stateNames = {
      [STATE.TITLE]: "TITLE",
      [STATE.PLAYING_NORMAL]: "PLAYING_NORMAL",
      [STATE.PLAYING_INVINCIBLE]: "PLAYING_INVINCIBLE",
      [STATE.PAUSED]: "PAUSED",
      [STATE.GAMEOVER]: "GAMEOVER",
      [STATE.WIN]: "WIN",
      [STATE.ENTER_HIGH_SCORE]: "ENTER_HIGH_SCORE",
      [STATE.SHOW_HIGH_SCORES]: "SHOW_HIGH_SCORES",
    };
    
    const gameStateEl = document.getElementById("debugGameState");
    if (gameStateEl) {
      let stateInfo = `<strong>Game State:</strong><br>`;
      stateInfo += `Current: ${stateNames[gameState] || gameState}<br><br>`;
      
      stateInfo += `<strong>Lives System:</strong><br>`;
      stateInfo += `Lives: ${lives}<br>`;
      stateInfo += `Deaths: ${deaths}<br>`;
      stateInfo += `Last Extra Life Score: ${lastExtraLifeScore}<br><br>`;
      
      stateInfo += `<strong>Score:</strong><br>`;
      stateInfo += `Score: ${score}<br>`;
      stateInfo += `Gems Collected: ${gemsCollected}<br><br>`;
      
      stateInfo += `<strong>Timing:</strong><br>`;
      stateInfo += `Level Start Time: ${levelStartTime.toFixed(0)}<br>`;
      stateInfo += `Current Time: ${performance.now().toFixed(0)}<br>`;
      stateInfo += `Level Elapsed: ${(performance.now() - levelStartTime).toFixed(0)}ms<br>`;
      stateInfo += `Total Run Time: ${totalRunTime.toFixed(0)}ms<br>`;
      stateInfo += `Per Level Times: [${perLevelTimes.map(t => t.toFixed(0)).join(", ")}]<br><br>`;
      
      stateInfo += `<strong>Level:</strong><br>`;
      stateInfo += `Current Level Index: ${currentLevelIndex}<br>`;
      stateInfo += `Level Name: ${levels[currentLevelIndex]?.name || "Unknown"}<br><br>`;
      
      stateInfo += `<strong>Invincibility:</strong><br>`;
      stateInfo += `Timer: ${invincibleTimer.toFixed(2)}s<br>`;
      stateInfo += `Active: ${invincibleTimer > 0 ? "Yes" : "No"}<br>`;
      
      gameStateEl.innerHTML = stateInfo;
    }
    
    // DEBUG_PLAYER: Collision Detection debug
    const collisionEl = document.getElementById("debugCollision");
    if (collisionEl) {
      let collisionInfo = `<strong>Collision Checks:</strong><br>`;
      collisionInfo += `Unicorns Count: ${unicorns.length}<br><br>`;
      
      if (unicorns.length > 0) {
        unicorns.forEach((unicorn, index) => {
          if (!unicorn) {
            collisionInfo += `Unicorn ${index + 1}: null<br>`;
            return;
          }
          
          const dx = player.x - unicorn.x;
          const dy = player.y - unicorn.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const overlapping = rectanglesOverlap(player, unicorn);
          const sameLayer = player.layer === unicorn.layer;
          const respawnPause = unicorn.respawnPause || 0;
          const wouldCollide = respawnPause <= 0 && sameLayer && overlapping;
          
          collisionInfo += `<strong>Unicorn ${index + 1}:</strong><br>`;
          collisionInfo += `&nbsp;&nbsp;Position: (${unicorn.x.toFixed(1)}, ${unicorn.y.toFixed(1)})<br>`;
          collisionInfo += `&nbsp;&nbsp;Player Position: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})<br>`;
          collisionInfo += `&nbsp;&nbsp;Distance: ${dist.toFixed(1)}px<br>`;
          collisionInfo += `&nbsp;&nbsp;Overlapping: ${overlapping ? "YES" : "NO"}<br>`;
          collisionInfo += `&nbsp;&nbsp;Same Layer: ${sameLayer ? "YES" : "NO"} (P:${player.layer} U:${unicorn.layer})<br>`;
          collisionInfo += `&nbsp;&nbsp;Respawn Pause: ${respawnPause.toFixed(2)}s<br>`;
          collisionInfo += `&nbsp;&nbsp;<strong>Would Collide: ${wouldCollide ? "YES ⚠️" : "NO"}</strong><br>`;
          collisionInfo += `&nbsp;&nbsp;Game State: ${stateNames[gameState] || gameState}<br>`;
          if (wouldCollide && gameState === STATE.PLAYING_NORMAL) {
            collisionInfo += `&nbsp;&nbsp;<strong style="color: red;">→ Would trigger handlePlayerDeath()!</strong><br>`;
          }
          collisionInfo += `<br>`;
        });
      }
      
      collisionInfo += `<strong>Collision Logic:</strong><br>`;
      collisionInfo += `Checking collisions: ${gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE ? "YES" : "NO"}<br>`;
      collisionInfo += `Debug Mode: ${MOVEMENT_DEBUG || "false"}<br>`;
      collisionInfo += `Skip collision check: ${MOVEMENT_DEBUG === "bridges" || MOVEMENT_DEBUG === "switches" ? "YES" : "NO"}<br>`;
      
      collisionEl.innerHTML = collisionInfo;
    }
  }
}

// Input handlers
function handleSpace() {
  if (gameState === STATE.TITLE || gameState === STATE.GAMEOVER || gameState === STATE.WIN || gameState === STATE.SHOW_HIGH_SCORES) {
    startGame();
  } else if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
    gameState = STATE.PAUSED;
    pauseReason = "manual"; // Manual pause
    updateUI();
  } else if (gameState === STATE.PAUSED) {
    gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
    pauseReason = null; // Clear pause reason when resuming
    updateUI();
  }
}

function handleStart() {
  startGame();
}

function handlePause() {
  if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
    gameState = STATE.PAUSED;
    pauseReason = "manual"; // Manual pause
    updateUI();
  } else if (gameState === STATE.PAUSED) {
    gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
    pauseReason = null; // Clear pause reason when resuming
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

function updatePortalAnimation(dt) {
  // Update player portal animation
  if (player.portalAnimating) {
    const PORTAL_ANIM_DURATION = 0.15; // seconds for entry animation
    player.portalAnimProgress += dt / PORTAL_ANIM_DURATION;
    
    if (player.portalAnimProgress >= 1.0) {
      // Animation complete - perform the teleport
      player.x = player.portalTargetX;
      player.y = player.portalTargetY;
      
      // Get the target position to track which portal we landed on
      const targetGrid = pixelToGrid(player.x, player.y);
      player.lastPortalRow = targetGrid.row;
      player.lastPortalCol = targetGrid.col;
      
      // Reset animation state
      player.portalAnimating = false;
      player.portalAnimProgress = 0;
      player.portalTargetX = null;
      player.portalTargetY = null;
    }
  }
  
  // v1.3: Update all unicorns' portal animations
  unicorns.forEach(unicorn => {
    if (unicorn && unicorn.portalAnimating) {
      const PORTAL_ANIM_DURATION = 0.15; // seconds for entry animation
      unicorn.portalAnimProgress += dt / PORTAL_ANIM_DURATION;
      
      if (unicorn.portalAnimProgress >= 1.0) {
        // Animation complete - perform the teleport
        unicorn.x = unicorn.portalTargetX;
        unicorn.y = unicorn.portalTargetY;
        
        // Get the target position to track which portal we landed on
        const targetGrid = pixelToGrid(unicorn.x, unicorn.y);
        unicorn.lastPortalRow = targetGrid.row;
        unicorn.lastPortalCol = targetGrid.col;
        
        // Reset animation state
        unicorn.portalAnimating = false;
        unicorn.portalAnimProgress = 0;
        unicorn.portalTargetX = null;
        unicorn.portalTargetY = null;
      }
    }
  });
}

function updateDots() {
  // Only collect dots when on layer 2 (floor/bridge layer)
  // Dots on bridges should not be collectible when in tunnel (layer 1)
  if (player.layer !== 2) return;
  
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
        // v1.3: Calculate final timing before checking high score
        const finalLevelTime = performance.now() - levelStartTime;
        perLevelTimes.push(finalLevelTime);
        totalRunTime += finalLevelTime;
        handleGameWin();
      }
    }
  }
}

function updateGem(dt) {
  // Enforce a maximum of 5 gems per run
  if (gemsCollected >= 5) return;

  // Update gem respawn delay after invincibility
  if (gemRespawnDelayAfterInvincible > 0) {
    gemRespawnDelayAfterInvincible -= dt;
    if (gemRespawnDelayAfterInvincible < 0) {
      gemRespawnDelayAfterInvincible = 0;
    }
  }
  
  // Don't spawn gem during invincibility OR if we're waiting for the post-invincibility delay
  if (invincibleTimer > 0 || gemRespawnDelayAfterInvincible > 0) {
    return;
  }
  
  // Spawn gem if it doesn't exist and conditions are met (not during invincibility, delay expired)
  if (!gem || (gem.x === 0 && gem.y === 0)) {
    const newGem = placeGem(dots);
    if (newGem) {
      gem = newGem;
    }
  }
  
  if (rectanglesOverlap(player, gem)) {
    invincibleTimer = INVINCIBLE_SECONDS;
    gameState = STATE.PLAYING_INVINCIBLE;
    // Reset tagged state for all unicorns when a new gem is collected
    unicorns.forEach(u => {
      if (u) u.tagged = false;
    });
    unicornTagged = false; // Legacy flag for backwards compatibility
    // Don't set gemRespawnDelayAfterInvincible here - it will be set when invincibility ends
    score += 5;
    gemsCollected += 1;
    gem = { x: 0, y: 0, w: 18, h: 18 }; // Hide gem immediately
    // Immediately choose a direction that moves all unicorns away from the player
    unicorns.forEach(u => {
      if (u) chooseAvoidDirection(u, player, maze, getSwitchAt);
    });
    updateUI();
  }
  
  // v1.3: Award extra life at score milestones
  if (score >= lastExtraLifeScore + EXTRA_LIFE_SCORE_MILESTONE) {
    lives += 1;
    lastExtraLifeScore = score;
    floatTexts.push({ x: player.x, y: player.y - 20, text: "EXTRA LIFE!", life: 2.0, maxLife: 2.0 });
    updateUI();
  }
}

// v1.3: Handle game over with lives system
function handlePlayerDeath() {
  console.log('[handlePlayerDeath] Called', { 
    livesBefore: lives, 
    livesAfter: lives - 1, 
    deaths: deaths + 1, 
    gameState,
    currentLevelIndex,
    levelName: levels[currentLevelIndex]?.name
  });
  
  // Safety check: ensure lives is valid
  if (typeof lives !== 'number' || lives < 0) {
    console.error('[handlePlayerDeath] ERROR: Invalid lives value:', lives);
    lives = 0; // Set to 0 to trigger game over
  }
  
  deaths += 1;
  lives -= 1;
  
  console.log('[handlePlayerDeath] After decrement', { lives, livesIsZeroOrLess: lives <= 0 });
  
  if (lives <= 0) {
    console.log('[handlePlayerDeath] Game Over - no lives left');
    // Game over - calculate final timing
    const finalLevelTime = performance.now() - levelStartTime;
    if (currentLevelIndex < perLevelTimes.length || perLevelTimes.length === 0) {
      perLevelTimes.push(finalLevelTime);
      totalRunTime += finalLevelTime;
    }
    handleGameOver();
  } else {
    console.log('[handlePlayerDeath] Resetting positions, lives remaining:', lives);
    try {
      // Reset positions but continue playing - recreate entities from spawns
      if (currentLevelIndex < 0 || currentLevelIndex >= levels.length) {
        console.error('[handlePlayerDeath] ERROR: Invalid level index:', currentLevelIndex, 'Levels length:', levels.length);
        // Fallback: just reset player, keep existing unicorns
        const playerSpawn = { row: 1, col: 1 };
        const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
        player.x = playerPos.x;
        player.y = playerPos.y;
        player.dirX = 0;
        player.dirY = 0;
        player.desiredX = 0;
        player.desiredY = 0;
        gameState = STATE.PAUSED;
        pauseReason = "life_lost";
        updateUI();
        return;
      }
      
      const level = levels[currentLevelIndex];
      if (!level) {
        console.error('[handlePlayerDeath] ERROR: Level is null/undefined at index:', currentLevelIndex);
        // Fallback
        const playerSpawn = { row: 1, col: 1 };
        const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
        player.x = playerPos.x;
        player.y = playerPos.y;
        player.dirX = 0;
        player.dirY = 0;
        player.desiredX = 0;
        player.desiredY = 0;
        gameState = STATE.PAUSED;
        pauseReason = "life_lost";
        updateUI();
        return;
      }
      
      console.log('[handlePlayerDeath] Level:', level, 'Level index:', currentLevelIndex);
      const { spawns } = createMazeForLevel(level);
      console.log('[handlePlayerDeath] Spawns:', JSON.stringify(spawns, null, 2));
      
      // Reset player
      const playerSpawn = spawns.player || { row: 1, col: 1 };
      const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
      player.x = playerPos.x;
      player.y = playerPos.y;
      player.dirX = 0;
      player.dirY = 0;
      player.desiredX = 0; // Clear desired direction to prevent immediate movement
      player.desiredY = 0;
      player.layer = 2; // Reset to floor layer
      console.log('[handlePlayerDeath] Player reset to:', { x: player.x, y: player.y });
      
      // Reset unicorns - recreate from spawns to ensure they're properly initialized
      const entities = resetEntities(spawns);
      console.log('[handlePlayerDeath] Entities from resetEntities:', { 
        unicornsCount: entities.unicorns?.length || 0,
        hasUnicorn: !!entities.unicorn 
      });
      unicorns = entities.unicorns || (entities.unicorn ? [entities.unicorn] : []);
      console.log('[handlePlayerDeath] Unicorns reset, count:', unicorns.length);
      
      if (unicorns.length === 0) {
        console.error('[handlePlayerDeath] WARNING: No unicorns after reset!');
      }
      
      // Clear unicorn trail and stars on respawn
      unicornTrail = [];
      unicornStars = [];
      unicornTagged = false;
      
      invincibleTimer = 1.0; // Brief invincibility after respawn
      gameState = STATE.PAUSED; // Pause the game after respawn
      pauseReason = "life_lost"; // Mark as paused due to life loss
      console.log('[handlePlayerDeath] Game state set to PAUSED after respawn, lives:', lives);
      updateUI();
      console.log('[handlePlayerDeath] Complete, game paused - player can resume');
    } catch (error) {
      console.error('[handlePlayerDeath] ERROR during reset:', error);
      // Fallback: just reset player position, keep existing unicorns
      const playerSpawn = { row: 1, col: 1 };
      const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
      player.x = playerPos.x;
      player.y = playerPos.y;
      player.dirX = 0;
      player.dirY = 0;
      player.desiredX = 0;
      player.desiredY = 0;
      gameState = STATE.PAUSED;
      pauseReason = "life_lost";
      updateUI();
    }
  }
}

// v1.3: Handle game over - check high score
async function handleGameOver() {
  console.log('[handleGameOver] Called', { score, lives, deaths });
  
  // Ensure high scores are loaded
  if (highScores.length === 0) {
    highScores = await storage.loadHighScores();
    console.log('[handleGameOver] Loaded high scores:', highScores.length);
  }
  
  gameState = STATE.GAMEOVER;
  updateUI();
  
  // Check if score qualifies for high score
  if (checkQualifiesForHighScore(score, highScores)) {
    console.log('[handleGameOver] Score qualifies for high score entry');
    gameState = STATE.ENTER_HIGH_SCORE;
    updateUI();
    initHighScoreEntry(highScoreContainer, async (name) => {
      const entry = {
        name: name.toUpperCase().slice(0, 5),
        score: score,
        levelReached: currentLevelIndex + 1,
        levelsCompleted: currentLevelIndex,
        timing: {
          totalMs: totalRunTime,
          perLevelMs: [...perLevelTimes]
        },
        deaths: deaths,
        unicornsDefeated: 0, // Future stat
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      highScores = addHighScore(entry, highScores);
      await storage.saveHighScores(highScores);
      
      gameState = STATE.SHOW_HIGH_SCORES;
      updateUI();
      displayHighScores(highScoreContainer, highScores);
    });
  } else {
    console.log('[handleGameOver] Score does not qualify, showing high score table');
    // Score doesn't qualify, but still show the high score table
    gameState = STATE.SHOW_HIGH_SCORES;
    updateUI();
    displayHighScores(highScoreContainer, highScores);
  }
}

// v1.3: Handle game win - check high score
async function handleGameWin() {
  gameState = STATE.WIN;
  updateUI();
  
  // Check if score qualifies for high score
  if (checkQualifiesForHighScore(score, highScores)) {
    gameState = STATE.ENTER_HIGH_SCORE;
    updateUI();
    initHighScoreEntry(highScoreContainer, async (name) => {
      const entry = {
        name: name.toUpperCase().slice(0, 5),
        score: score,
        levelReached: levels.length,
        levelsCompleted: levels.length,
        timing: {
          totalMs: totalRunTime,
          perLevelMs: [...perLevelTimes]
        },
        deaths: deaths,
        unicornsDefeated: 0, // Future stat
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      highScores = addHighScore(entry, highScores);
      await storage.saveHighScores(highScores);
      
      gameState = STATE.SHOW_HIGH_SCORES;
      updateUI();
      displayHighScores(highScoreContainer, highScores);
    });
  }
}

// State management
function startGame() {
  if (MOVEMENT_DEBUG) {
    // In debug mode, just load level 0 (which will be ignored)
    loadLevel(0, { resetScore: true, resetLives: true, resetTiming: true, showIntro: false });
  } else {
    const hasDebugLevel = typeof DEBUG_START_LEVEL === "number";
    const clamped = hasDebugLevel
      ? Math.max(0, Math.min(levels.length - 1, DEBUG_START_LEVEL))
      : 0;
    loadLevel(clamped, { resetScore: true, resetLives: true, resetTiming: true, showIntro: true });
  }
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
    
    // v1.3: Update all unicorns in normal mode or unicorn_ai debug mode
    if (!MOVEMENT_DEBUG || MOVEMENT_DEBUG === "unicorn_ai") {
      unicorns.forEach((unicorn, index) => {
        if (!unicorn) return;
        
        // Use ref objects for mutable values
        const unicornRespawnPauseRef = { value: unicorn.respawnPause || 0 };
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
        
        // Check for bridge/tunnel violations - pause game if detected
        if (unicornResult && unicornResult.pauseGame) {
          gameState = STATE.PAUSED;
          pauseReason = "manual"; // Debug pause - treat as manual
          updateUI();
          console.error("GAME PAUSED due to unicorn bridge/tunnel violation");
          console.error("Violation details:", unicornResult.violationInfo);
          // Don't continue processing - game is paused
        }
        
        // Update unicorn's respawn pause
        unicorn.respawnPause = unicornRespawnPauseRef.value;
        
        if (unicornResult && unicornResult.newStars) {
          unicornStars.push(...unicornResult.newStars);
        }
      });
      
      updateTrail(dt);
      updateStars(dt);
    }
    
    updateFloatTexts(dt);
    updateSwitches(dt);
    updatePortalAnimation(dt);
    updateDots();
    // Skip gem updates in debug mode
    if (!MOVEMENT_DEBUG) {
      updateGem(dt);
    }
    
    if (invincibleTimer > 0) {
      invincibleTimer -= dt;
      if (invincibleTimer <= 0) {
        invincibleTimer = 0;
        gameState = STATE.PLAYING_NORMAL;
        // Start the 20 second delay before gem can respawn
        gemRespawnDelayAfterInvincible = GEM_RESPAWN_DELAY_AFTER_INVINCIBLE;
        updateUI();
      }
    }

    // v1.3: Check collisions with all unicorns (skip in bridges and switches debug modes)
    if (MOVEMENT_DEBUG !== "bridges" && MOVEMENT_DEBUG !== "switches") {
      for (const unicorn of unicorns) {
        if (!unicorn) continue;
        
        // No collision effects while unicorn is in respawn pause; it's effectively not there
        // Also check if player and unicorn are on the same layer - no collision if on different layers
        if ((unicorn.respawnPause || 0) <= 0 && player.layer === unicorn.layer && rectanglesOverlap(player, unicorn)) {
          if (gameState === STATE.PLAYING_INVINCIBLE) {
            // Tag unicorn - each unicorn can be tagged once per gem/invincibility window
            // v1.3: Track tagged state per unicorn, not globally, so multiple unicorns can be caught
            if (!unicorn.tagged) {
              unicorn.tagged = true;
              score += 10;
              floatTexts.push({ x: unicorn.x, y: unicorn.y - 10, text: "+10", life: 0.8, maxLife: 0.8 });

              // Respawn unicorn at maze center
              const centerGrid = { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2) };
              const centerPos = gridToPixel(centerGrid.col, centerGrid.row);
              unicorn.x = centerPos.x;
              unicorn.y = centerPos.y;
              unicorn.dirX = 0;
              unicorn.dirY = 0;
              unicorn.respawnPause = 3; // seconds of pause before moving again

              // Don't end invincibility - let it continue so other unicorns can be caught
              // Invincibility will end naturally when invincibleTimer runs out
              updateUI();
            }
            // Continue checking other unicorns - don't break
          } else {
            // v1.3: Lives system - handle death
            console.log('[Collision] Player hit by unicorn', { 
              unicornIndex: unicorns.indexOf(unicorn),
              playerPos: { x: player.x, y: player.y },
              unicornPos: { x: unicorn.x, y: unicorn.y },
              lives,
              gameState
            });
            handlePlayerDeath();
            console.log('[Collision] After handlePlayerDeath, gameState:', gameState);
            break; // Exit the unicorn collision loop to avoid multiple collisions this frame
          }
        }
      }
    }
  }

  // v1.3: Pass unicorns array instead of single unicorn
  draw(
    ctx,
    maze,
    portals,
    switches,
    dots,
    gem,
    unicornTrail,
    unicornStars,
    floatTexts,
    player,
    unicorns,
    gameState,
    levelIntroTimer,
    levelIntroText,
    unicornRespawnPause,
    invincibleTimer,
    getSwitchAt,
    MOVEMENT_DEBUG,
    pauseReason,
    lives
  );
  
  // Update debug HUD (when any debug flag is enabled, and not paused so you can copy the info)
  if ((MOVEMENT_DEBUG || DEBUG_PLAYER || DEBUG_UNICORN || DEBUG_PORTALS || DEBUG_BRIDGES || DEBUG_SWITCHES) && gameState !== STATE.PAUSED) {
    updateDebugHUD();
  }
  
  requestAnimationFrame(loop);
}

// v1.3: Initialize - load high scores
(async () => {
  highScores = await storage.loadHighScores();
  updateUI();
})();

// Initialize entities
const initialSpawns = { player: { row: 1, col: 1 }, unicorn: { row: 13, col: 19 } };
const entities = resetEntities(initialSpawns);
player = entities.player;
unicorns = entities.unicorns || (entities.unicorn ? [entities.unicorn] : []);
updateUI();
// Show debug HUD if any debug flag is enabled
if ((MOVEMENT_DEBUG || DEBUG_PLAYER || DEBUG_UNICORN || DEBUG_PORTALS || DEBUG_BRIDGES || DEBUG_SWITCHES) && debugHud) {
  debugHud.style.display = "block";
}

// v1.3: Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('[Service Worker] Registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[Service Worker] Registration failed:', error);
        // Service worker failure shouldn't block the game
      });
  });
}

// v1.3: Mobile landscape lock
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('landscape').catch(() => {
    // Lock may fail in some browsers, that's okay
  });
}

// Auto-start first run; restart via button/space still works
startGame();
requestAnimationFrame(loop);
