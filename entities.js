// v1.3.0 - Entity initialization and management

import { TILE, PLAYER_SPEED, UNICORN_SPEED } from './config.js';
import { gridToPixel } from './utils.js';

// v1.3: Unicorn definitions
export const UNICORN_DEFINITIONS = {
  classic: {
    id: "classic",
    name: "Classic",
    color: "#ff7eb6",
    movement: { baseSpeed: 1.0, speedVariance: 0, turnDelayChance: 0 },
    behavior: { chaseBias: 1.0, randomBias: 0, tunnelAwareness: true },
    invincibleResponse: "flee"
  },
  drunky: {
    id: "drunky",
    name: "Drunk-y",
    color: "#48CAE4",
    movement: { baseSpeed: 1.0, speedVariance: 0.3, turnDelayChance: 0.2 },
    behavior: { chaseBias: 0.6, randomBias: 0.4, tunnelAwareness: false },
    invincibleResponse: "flee"
  }
};

// v1.3: Create unicorn from definition
export function createUnicornFromDefinition(definition, spawn) {
  const def = UNICORN_DEFINITIONS[definition.type] || UNICORN_DEFINITIONS.classic;
  const baseSpeed = UNICORN_SPEED * def.movement.baseSpeed;
  const speedVar = baseSpeed * def.movement.speedVariance;
  const speed = baseSpeed + (Math.random() * speedVar * 2 - speedVar);
  const pos = gridToPixel(spawn.col, spawn.row);
  
  return {
    x: pos.x,
    y: pos.y,
    w: 24,
    h: 24,
    dirX: -1,
    dirY: 0,
    speed: speed,
    layer: 0, // v1.3: Layer system
    definition: def, // Store reference for behavior
    randomStepsLeft: 0,
    respawnPause: 0,
    tagged: false,
  };
}

export function resetEntities(spawns) {
  const playerSpawn = spawns?.player || { row: 1, col: 1 };
  const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);

  const player = {
    x: playerPos.x,
    y: playerPos.y,
    w: 20,
    h: 20,
    dirX: 0,
    dirY: 0,
    desiredX: 0,
    desiredY: 0,
    speed: PLAYER_SPEED,
    layer: 2, // v1.3: Layer system - start on layer 2 (floor level)
    lastPortalRow: null, // Track last portal to prevent infinite loops
    lastPortalCol: null,
    portalAnimProgress: 0, // 0-1, animation progress for portal entry/exit
    portalAnimating: false, // Whether portal animation is active
    portalTargetX: null, // Target position for portal teleport
    portalTargetY: null,
  };

  // v1.3: Support multiple unicorns
  const unicorns = [];
  if (spawns?.unicorns) {
    for (const uc of spawns.unicorns) {
      unicorns.push(createUnicornFromDefinition(uc, uc.spawn));
    }
  } else {
    // Fallback for old format
    const unicornSpawn = spawns?.unicorn || { row: 13, col: 19 };
    unicorns.push(createUnicornFromDefinition({ type: "classic" }, unicornSpawn));
  }

  // For legacy callers, also expose the first unicorn as `unicorn`.
  const unicorn = unicorns[0] || null;

  return { player, unicorns, unicorn };
}

export function seedDotsFromMaze(sourceMaze, levelConfig, spawns) {
  const dots = new Set();
  const playerSpawn = spawns?.player;
  const unicornSpawns = spawns?.unicorns || (spawns?.unicorn ? [spawns.unicorn] : []);

  for (let r = 0; r < sourceMaze.length; r++) {
    for (let c = 0; c < sourceMaze[r].length; c++) {
      const tile = sourceMaze[r][c];
      // Basic rule: dots on floor/bridge/switch, but not on portals
      const walkableForDots = tile === 0 || tile === 6 || tile === 7;
      if (!walkableForDots) continue;
      // Avoid spawning on player start tile
      if (playerSpawn && playerSpawn.row === r && playerSpawn.col === c) continue;
      // Avoid spawning on any unicorn start tiles
      if (unicornSpawns.some(uc => uc.spawn && uc.spawn.row === r && uc.spawn.col === c)) continue;
      dots.add(`${r},${c}`);
    }
  }

  return dots;
}

export function placeGem(dots) {
  const floors = Array.from(dots).map((id) => id.split(",").map(Number));
  const candidates = floors.length ? floors : [];
  if (!candidates.length) return null;
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  const pos = gridToPixel(choice[1], choice[0]);
  return {
    x: pos.x,
    y: pos.y,
    w: 18,
    h: 18
  };
}

