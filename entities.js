// v1.2.1 - Entity initialization and management

import { TILE, PLAYER_SPEED, UNICORN_SPEED } from './config.js';
import { gridToPixel } from './utils.js';

export function resetEntities(spawns) {
  const playerSpawn = spawns?.player || { row: 1, col: 1 };
  const unicornSpawn = spawns?.unicorn || { row: 13, col: 19 };
  const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
  const unicornPos = gridToPixel(unicornSpawn.col, unicornSpawn.row);

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
  };

  const unicorn = {
    x: unicornPos.x,
    y: unicornPos.y,
    w: 24,
    h: 24,
    dirX: -1,
    dirY: 0,
    speed: UNICORN_SPEED,
  };

  return { player, unicorn };
}

export function seedDotsFromMaze(sourceMaze, levelConfig, spawns) {
  const dots = new Set();
  const playerSpawn = spawns?.player;
  const unicornSpawn = spawns?.unicorn;

  for (let r = 0; r < sourceMaze.length; r++) {
    for (let c = 0; c < sourceMaze[r].length; c++) {
      const tile = sourceMaze[r][c];
      // Basic rule: dots on floor/bridge/switch, but not on portals
      const walkableForDots = tile === 0 || tile === 6 || tile === 7;
      if (!walkableForDots) continue;
      // Avoid spawning on player/unicorn start tiles
      if (playerSpawn && playerSpawn.row === r && playerSpawn.col === c) continue;
      if (unicornSpawn && unicornSpawn.row === r && unicornSpawn.col === c) continue;
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

