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
  MOVEMENT_DEBUG,
  DEBUG_ROWS,
  DEBUG_COLS,
} from './config.js';

import { pixelToGrid, gridToPixel, rectanglesOverlap, tileAt, isPortal, getTileMetadata, tileExistsOnLayer, blocked } from './utils.js';
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
const debugHud = document.getElementById("debugHud");

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
  
  // In debug mode, use a dummy level config
  const level = MOVEMENT_DEBUG ? { type: "debug" } : levels[currentLevelIndex];
  const { maze: newMaze, portals: newPortals, switches: newSwitches, spawns } =
    createMazeForLevel(level);
  maze = newMaze;
  portals = newPortals;
  switches = newSwitches;
  
  const entities = resetEntities(spawns);
  player = entities.player;
  // Skip unicorn initialization in debug mode
  if (!MOVEMENT_DEBUG) {
    unicorn = entities.unicorn;
  } else {
    unicorn = null;
  }
  
  dots = seedDotsFromMaze(maze, level, spawns);
  gemCooldown = 0;
  // Skip gem placement in debug mode
  if (!MOVEMENT_DEBUG) {
    const newGem = placeGem(dots);
    if (newGem) {
      gem = newGem;
    }
  }
  
  if (resetScore) score = 0;
  
  // Skip intro in debug mode
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
  
  // Show/hide debug HUD based on MOVEMENT_DEBUG
  if (debugHud) {
    debugHud.style.display = MOVEMENT_DEBUG ? "block" : "none";
  }
}

function updateDebugHUD() {
  if (!MOVEMENT_DEBUG || !debugHud) return;
  
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
  
  if (portalInfoEl) {
    portalInfoEl.textContent = portalInfo;
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
  
  // Bridge/Tunnel debug info
  if (bridgeTunnelEl) {
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
  
  // Collision corners debug
  if (collisionCornersEl) {
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
      cornerInfo += `Would Block: ${wouldBlock}<br>`;
      
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
  
  // Movement start debug
  if (movementStartEl) {
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
      startInfo += `Test position: (${testTile.row},${testTile.col}) tile=${testCode}<br>`;
      startInfo += `Test target layer: ${testTargetLayer}<br>`;
      startInfo += `Test blocked: ${testBlocked}<br>`;
      startInfo += `<br><strong>After checks:</strong><br>`;
      // Calculate canStart properly
      let calculatedCanStart = true;
      if (currentTileCode === 8) {
        if (hasHorizontalPath && !hasVerticalPath && player.desiredY !== 0) calculatedCanStart = false;
        if (hasVerticalPath && !hasHorizontalPath && player.desiredX !== 0) calculatedCanStart = false;
      }
      startInfo += `canStart calculated: ${calculatedCanStart}<br>`;
      startInfo += `Final canStart: ${calculatedCanStart && !testBlocked}<br>`;
      startInfo += `Current dirX: ${player.dirX}, dirY: ${player.dirY}<br>`;
      startInfo += `Would set dirX to: ${player.desiredX}, dirY to: ${player.desiredY}<br>`;
      
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

function updatePortalAnimation(dt) {
  if (!player.portalAnimating) return;
  
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
  if (MOVEMENT_DEBUG) {
    // In debug mode, just load level 0 (which will be ignored)
    loadLevel(0, { resetScore: true, showIntro: false });
  } else {
    const hasDebugLevel = typeof DEBUG_START_LEVEL === "number";
    const clamped = hasDebugLevel
      ? Math.max(0, Math.min(levels.length - 1, DEBUG_START_LEVEL))
      : 0;
    loadLevel(clamped, { resetScore: true, showIntro: true });
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
    
    // Skip unicorn updates in debug mode
    if (!MOVEMENT_DEBUG) {
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
        gameState = STATE.PLAYING_NORMAL;
        updateUI();
      }
    }

    // Skip unicorn collision checks in debug mode
    if (!MOVEMENT_DEBUG) {
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
    getSwitchAt,
    MOVEMENT_DEBUG
  );
  
  // Update debug HUD (only when not paused, so you can copy the info)
  if (MOVEMENT_DEBUG && gameState !== STATE.PAUSED) {
    updateDebugHUD();
  }
  
  requestAnimationFrame(loop);
}

// Initialize
const initialSpawns = { player: { row: 1, col: 1 }, unicorn: { row: 13, col: 19 } };
const entities = resetEntities(initialSpawns);
player = entities.player;
unicorn = entities.unicorn;
updateUI();
// Show debug HUD if in debug mode
if (MOVEMENT_DEBUG && debugHud) {
  debugHud.style.display = "block";
}

// Auto-start first run; restart via button/space still works
startGame();
requestAnimationFrame(loop);
