// v1.3.0 - Unicorn AI logic

import { TILE, RANDOM_INTERSECTION_COUNT, STATE, DEBUG_UNICORN, UNICORN_SPEED } from './config.js';
import { pixelToGrid, gridToPixel, blocked, tileAt } from './utils.js';
import { applyPortal } from './movement.js';
import { UNICORN_DEFINITIONS } from './entities.js';

// Helper function to immediately choose a direction that moves away from player
export function chooseAvoidDirection(unicorn, player, maze) {
  const dx = player.x - unicorn.x;
  const dy = player.y - unicorn.y;
  const allDirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];
  
  // Get all valid directions (not blocked by walls)
  const valid = allDirs.filter(dir => {
    const testX = unicorn.x + dir.x * TILE * 0.6;
    const testY = unicorn.y + dir.y * TILE * 0.6;
    return !blocked(maze, testX, testY, unicorn.w, unicorn.h);
  });
  
  if (valid.length === 0) return; // No valid directions
  
  // Calculate distance to player for each valid direction
  const dirScores = valid.map(dir => {
    const newX = unicorn.x + dir.x * TILE;
    const newY = unicorn.y + dir.y * TILE;
    const newDx = player.x - newX;
    const newDy = player.y - newY;
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    
    // Current distance
    const currentDist = Math.sqrt(dx * dx + dy * dy);
    
    return {
      dir,
      dist: newDist,
      increasesDistance: newDist > currentDist
    };
  });
  
  // Check if reversing current direction would increase distance
  const reverseDir = { x: -unicorn.dirX, y: -unicorn.dirY };
  const reverseOption = dirScores.find(d => d.dir.x === reverseDir.x && d.dir.y === reverseDir.y);
  
  if (reverseOption && reverseOption.increasesDistance) {
    // Reversing would move away, so reverse
    unicorn.dirX = reverseDir.x;
    unicorn.dirY = reverseDir.y;
    return;
  }
  
  // Otherwise, pick the direction that increases distance the most
  const bestDir = dirScores
    .filter(d => d.increasesDistance)
    .sort((a, b) => b.dist - a.dist)[0];
  
  if (bestDir) {
    unicorn.dirX = bestDir.dir.x;
    unicorn.dirY = bestDir.dir.y;
  } else {
    // If no direction increases distance, pick the one that minimizes distance increase
    // (fallback - should rarely happen)
    const leastBad = dirScores.sort((a, b) => a.dist - b.dist)[0];
    if (leastBad) {
      unicorn.dirX = leastBad.dir.x;
      unicorn.dirY = leastBad.dir.y;
    }
  }
}

export function chooseUnicornDir(unicorn, player, maze, gameState, randomStepsLeftRef, getSwitchAt) {
  const def = unicorn.definition || UNICORN_DEFINITIONS.classic;
  
  const at = pixelToGrid(unicorn.x, unicorn.y);
  const center = gridToPixel(at.col, at.row);
  // Only make decisions when centered on a tile
  if (Math.abs(unicorn.x - center.x) > 1 || Math.abs(unicorn.y - center.y) > 1) return false;

  unicorn.x = center.x;
  unicorn.y = center.y;

  const dx = player.x - unicorn.x;
  const dy = player.y - unicorn.y;
  const distX = Math.abs(dx);
  const distY = Math.abs(dy);
  const allDirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];
  const valid = allDirs.filter(dir => {
    const testX = unicorn.x + dir.x * TILE * 0.6;
    const testY = unicorn.y + dir.y * TILE * 0.6;
    return !blocked(maze, testX, testY, unicorn.w, unicorn.h);
  });

  // Determine intersection/corner status (exclude pure forward/back corridor)
  const reverseDir = { x: -unicorn.dirX, y: -unicorn.dirY };
  const validNonReverse = valid.filter(d => !(d.x === reverseDir.x && d.y === reverseDir.y));
  const isIntersection = validNonReverse.length >= 2; // 3-way or 4-way
  const isCorner = validNonReverse.length === 1 && valid.length >= 2 && !(valid[0].x === -valid[1].x && valid[0].y === -valid[1].y);

  // v1.3: Apply turn delay chance from definition
  const shouldDelay = Math.random() < def.movement.turnDelayChance;
  if (shouldDelay && !isIntersection && !isCorner) return false;

  // If we're not at an intersection/corner and not in random mode, keep current direction
  if (randomStepsLeftRef.value <= 0 && !isIntersection && !isCorner) return false;

  if (randomStepsLeftRef.value > 0) {
    randomStepsLeftRef.value--;
    const pick = valid[Math.floor(Math.random() * valid.length)];
    unicorn.dirX = pick?.x ?? unicorn.dirX;
    unicorn.dirY = pick?.y ?? unicorn.dirY;
    return true;
  }

  const chooseDir = (candidates) => {
    for (const dir of candidates) {
      if (validNonReverse.find(v => v.x === dir.x && v.y === dir.y)) {
        unicorn.dirX = dir.x;
        unicorn.dirY = dir.y;
        return true;
      }
    }
    return false;
  };

  // Mode: chase (normal) vs avoid (player invincible)
  const chaseMode = gameState !== STATE.PLAYING_INVINCIBLE;
  
  // v1.3: Apply chase/random bias from definition
  const behaviorBias = chaseMode ? def.behavior.chaseBias : (1 - def.behavior.chaseBias); // Invert bias for flee
  const randomChance = def.behavior.randomBias;
  
  if (Math.random() < randomChance) {
    // Random movement
    const pick = valid[Math.floor(Math.random() * valid.length)];
    if (pick) {
      unicorn.dirX = pick.x;
      unicorn.dirY = pick.y;
      if (DEBUG_UNICORN) console.log("Unicorn choose", { dir: pick, reason: "random" });
      return true;
    }
  } else if (Math.random() < behaviorBias) {
    // Chase/flee logic
    const primary = chaseMode
      ? (distX > distY
          ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
          : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }])
      : (distX > distY
          ? [{ x: -Math.sign(dx), y: 0 }, { x: 0, y: -Math.sign(dy) }]
          : [{ x: 0, y: -Math.sign(dy) }, { x: -Math.sign(dx), y: 0 }]);

    if (chooseDir(primary)) {
      if (DEBUG_UNICORN) console.log("Unicorn choose", { dir: { x: unicorn.dirX, y: unicorn.dirY }, reason: chaseMode ? "greedy" : "avoid" });
      return true;
    }
  }

  // Fallback: any valid non-reverse, else any valid
  const pick = (validNonReverse[0] ?? valid[0]);
  if (pick) {
    unicorn.dirX = pick.x;
    unicorn.dirY = pick.y;
    if (DEBUG_UNICORN) console.log("Unicorn choose", { dir: pick, reason: "fallback" });
    return true;
  }
  
  return false;
}

export function updateUnicorn(dt, unicorn, player, maze, switches, portals, gameState, unicornRespawnPauseRef, randomStepsLeftRef, unicornTrail, unicornStars, invincibleTimer, getSwitchAt) {
  // During respawn pause, unicorn stays still and does not decide directions
  if (unicornRespawnPauseRef.value > 0) {
    unicornRespawnPauseRef.value -= dt;
    if (unicornRespawnPauseRef.value < 0) unicornRespawnPauseRef.value = 0;
    return;
  }

  const prevX = unicorn.x;
  const prevY = unicorn.y;

  chooseUnicornDir(unicorn, player, maze, gameState, randomStepsLeftRef, getSwitchAt);
  
  // v1.3: Apply speed variance from definition
  const def = unicorn.definition || UNICORN_DEFINITIONS.classic;
  const baseSpeed = UNICORN_SPEED * def.movement.baseSpeed;
  const speedVar = baseSpeed * def.movement.speedVariance;
  const currentSpeed = baseSpeed + (Math.random() * speedVar * 2 - speedVar);
  unicorn.speed = currentSpeed;

  // Early look-ahead for special tiles (bridges/switches):
  // If the unicorn is heading directly into a blocked side of one of these,
  // reverse and enter random mode *before* it actually reaches the tile.
  if (unicorn.dirX !== 0 || unicorn.dirY !== 0) {
    const lookAheadDist = unicorn.w * 0.5; // about half a unicorn width
    const aheadX = unicorn.x + unicorn.dirX * lookAheadDist;
    const aheadY = unicorn.y + unicorn.dirY * lookAheadDist;
    const aheadTile = pixelToGrid(aheadX, aheadY);
    const aheadCode = tileAt(maze, aheadTile.row, aheadTile.col);

    if (aheadCode === 6 || aheadCode === 7) {
      let willBeBlocked = false;
      if (aheadCode === 6) {
        // Bridge blocks horizontal travel along it
        if (unicorn.dirX !== 0) willBeBlocked = true;
      } else {
        const sw = getSwitchAt(aheadTile.row, aheadTile.col);
        if (sw) {
          if (sw.mode === "vertical" && unicorn.dirX !== 0) willBeBlocked = true;
          if (sw.mode === "horizontal" && unicorn.dirY !== 0) willBeBlocked = true;
        }
      }

        if (willBeBlocked) {
          unicorn.dirX = -unicorn.dirX;
          unicorn.dirY = -unicorn.dirY;
          randomStepsLeftRef.value = RANDOM_INTERSECTION_COUNT;
          if (DEBUG_UNICORN) {
            console.log("Unicorn early reverse before special tile", {
              aheadTile,
              aheadCode,
            });
          }
          return;
        }
    }
  }

  let moveX = unicorn.dirX * currentSpeed * dt;
  let moveY = unicorn.dirY * currentSpeed * dt;

  // Bridges & switches: unicorn must respect the same directional blocks as the player
  const currentTile = pixelToGrid(unicorn.x, unicorn.y);
  const currentCode = tileAt(maze, currentTile.row, currentTile.col);
  // On a bridge, only allow vertical crossing (no horizontal movement along it)
  // For the unicorn, we *only* cancel the movement component and keep its
  // facing direction so that the "wall hit" logic below can correctly
  // reverse and enter temporary random mode instead of leaving the unicorn
  // directionless and stuck.
  if (currentCode === 6 && moveX !== 0) {
    moveX = 0;
  }
  if (currentCode === 7) {
    const sw = getSwitchAt(currentTile.row, currentTile.col);
    if (sw) {
      if (sw.mode === "vertical" && moveX !== 0) {
        moveX = 0;
      } else if (sw.mode === "horizontal" && moveY !== 0) {
        moveY = 0;
      }
    }
  }

  // Approaching bridges/switches from outside: treat blocked sides like walls
  const targetTile = pixelToGrid(unicorn.x + moveX, unicorn.y + moveY);
  const targetCode = tileAt(maze, targetTile.row, targetTile.col);
  if (targetCode === 6 && moveX !== 0) {
    moveX = 0;
  }
  if (targetCode === 7) {
    const sw = getSwitchAt(targetTile.row, targetTile.col);
    if (sw) {
      if (sw.mode === "vertical" && moveX !== 0) {
        moveX = 0;
      } else if (sw.mode === "horizontal" && moveY !== 0) {
        moveY = 0;
      }
    }
  }

  // If a bridge/switch completely blocks the intended move, treat it like a wall hit:
  // reverse direction and enter temporary random mode.
  if (moveX === 0 && moveY === 0) {
    unicorn.dirX = -unicorn.dirX;
    unicorn.dirY = -unicorn.dirY;
    randomStepsLeftRef.value = RANDOM_INTERSECTION_COUNT;
    if (DEBUG_UNICORN) {
      console.log("Unicorn blocked by special tile -> reverse & random", {
        tile: currentTile,
      });
    }
    return;
  }

  if (!blocked(maze, unicorn.x + moveX, unicorn.y, unicorn.w, unicorn.h)) unicorn.x += moveX;
  if (!blocked(maze, unicorn.x, unicorn.y + moveY, unicorn.w, unicorn.h)) unicorn.y += moveY;

  if (unicorn.x === prevX && unicorn.y === prevY) {
    unicorn.dirX = -unicorn.dirX;
    unicorn.dirY = -unicorn.dirY;
    randomStepsLeftRef.value = RANDOM_INTERSECTION_COUNT;
    if (DEBUG_UNICORN) console.log("Unicorn stuck -> reverse", { dirX: unicorn.dirX, dirY: unicorn.dirY });
  }

  // If still directionless, pick any open direction
  if (unicorn.dirX === 0 && unicorn.dirY === 0) {
    const dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 },
    ];
    for (const dir of dirs) {
      const testX = unicorn.x + dir.x * TILE * 0.6;
      const testY = unicorn.y + dir.y * TILE * 0.6;
      if (!blocked(maze, testX, testY, unicorn.w, unicorn.h)) {
        unicorn.dirX = dir.x;
        unicorn.dirY = dir.y;
        break;
      }
    }
  }

  applyPortal(unicorn, maze, portals);

  // Always leave a rainbow tail
  const newTrailEntry = {
    x: unicorn.x,
    y: unicorn.y,
    life: 0.35,
    maxLife: 0.35,
    hue: (performance.now() / 8) % 360
  };
  unicornTrail.push(newTrailEntry);

  // During invincibility, shoot rainbow star sparks
  const newStars = [];
  if (gameState === STATE.PLAYING_INVINCIBLE && invincibleTimer > 0) {
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      newStars.push({
        x: unicorn.x,
        y: unicorn.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        hue: (performance.now() / 5 + Math.random() * 40) % 360
      });
    }
  }

  // Return new stars to be added
  return { newStars };
}

