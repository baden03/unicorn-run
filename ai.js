// v1.3.0 - Unicorn AI logic

import { TILE, RANDOM_INTERSECTION_COUNT, STATE, DEBUG_UNICORN, UNICORN_SPEED, MOVEMENT_DEBUG } from './config.js';
import { pixelToGrid, gridToPixel, blocked, tileAt } from './utils.js';
import { applyPortal } from './movement.js';
import { UNICORN_DEFINITIONS } from './entities.js';

// Helper function to immediately choose a direction that moves away from player
export function chooseAvoidDirection(unicorn, player, maze, getSwitchAt = null) {
  const dx = player.x - unicorn.x;
  const dy = player.y - unicorn.y;
  const allDirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];
  
  // Get current tile info for bridge/tunnel restrictions
  const at = pixelToGrid(unicorn.x, unicorn.y);
  const currentTileCode = tileAt(maze, at.row, at.col);
  
  // Get all valid directions (not blocked by walls, layer-aware)
  const valid = allDirs.filter(dir => {
    const testX = unicorn.x + dir.x * TILE * 0.6;
    const testY = unicorn.y + dir.y * TILE * 0.6;
    const testTile = pixelToGrid(testX, testY);
    const testCode = tileAt(maze, testTile.row, testTile.col);
    
    // Prevent turning from tunnel (layer 1) onto a bridge - bridges don't allow this behavior
    if (unicorn.layer === 1 && testCode === 6) {
      return false; // Can't turn onto a bridge from a tunnel
    }
    
    // If on a bridge (layer 2), prevent turns that violate bridge orientation
    if (currentTileCode === 6 && unicorn.layer === 2) {
      const upTile = tileAt(maze, at.row - 1, at.col);
      const downTile = tileAt(maze, at.row + 1, at.col);
      const leftTile = tileAt(maze, at.row, at.col - 1);
      const rightTile = tileAt(maze, at.row, at.col + 1);
      const isVerticalBridge = (leftTile === 8 || rightTile === 8);
      const isHorizontalBridge = (upTile === 8 || downTile === 8);
      
      // Can't turn horizontal on vertical bridge, or vertical on horizontal bridge
      if (isVerticalBridge && dir.x !== 0) return false;
      if (isHorizontalBridge && dir.y !== 0) return false;
    }
    
    // If on a tunnel, prevent turns that violate tunnel orientation
    if (currentTileCode === 8) {
      const upTile = tileAt(maze, at.row - 1, at.col);
      const downTile = tileAt(maze, at.row + 1, at.col);
      const leftTile = tileAt(maze, at.row, at.col - 1);
      const rightTile = tileAt(maze, at.row, at.col + 1);
      const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
      const isVerticalTunnel = (upTile === 8 || downTile === 8);
      
      // Can't turn vertical on horizontal tunnel, or horizontal on vertical tunnel
      if (isHorizontalTunnel && dir.y !== 0) return false;
      if (isVerticalTunnel && dir.x !== 0) return false;
    }
    
    let testTargetLayer = unicorn.layer;
    if (unicorn.layer === 2 && testCode === 8) testTargetLayer = 1;
    else if (unicorn.layer === 1 && testCode === 0) testTargetLayer = 2;
    return !blocked(maze, testX, testY, unicorn.w, unicorn.h, unicorn.layer, testTargetLayer, dir.x, dir.y, getSwitchAt);
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
  // Use a tight threshold - only make decisions when very close to center
  // This ensures we only make decisions at actual intersections, not while moving
  const centerThreshold = 1.5; // pixels - tight threshold
  const offsetX = Math.abs(unicorn.x - center.x);
  const offsetY = Math.abs(unicorn.y - center.y);
  
  if (offsetX > centerThreshold || offsetY > centerThreshold) {
    if (DEBUG_UNICORN) console.log("Unicorn decision skipped: not centered", { 
      x: unicorn.x, y: unicorn.y, centerX: center.x, centerY: center.y,
      offsetX: offsetX.toFixed(2), offsetY: offsetY.toFixed(2),
      threshold: centerThreshold.toFixed(2)
    });
    return false;
  }

  // Snap to center for decision-making
  const oldX = unicorn.x;
  const oldY = unicorn.y;
  unicorn.x = center.x;
  unicorn.y = center.y;
  
  // Track last intersection to avoid making multiple decisions at the same one
  const intersectionKey = `${at.row},${at.col}`;
  if (unicorn.lastIntersectionKey === intersectionKey) {
    if (DEBUG_UNICORN) console.log("Unicorn decision skipped: already decided at this intersection", { 
      intersectionKey, lastKey: unicorn.lastIntersectionKey
    });
    return false;
  }
  
  if (DEBUG_UNICORN && (offsetX > 0.1 || offsetY > 0.1)) {
    console.log("Unicorn snapped to center", { 
      oldX: oldX.toFixed(2), oldY: oldY.toFixed(2),
      newX: unicorn.x, newY: unicorn.y,
      offsetX: offsetX.toFixed(2), offsetY: offsetY.toFixed(2)
    });
  }

  const dx = player.x - unicorn.x;
  const dy = player.y - unicorn.y;
  const distX = Math.abs(dx);
  const distY = Math.abs(dy);
  const currentDist = Math.sqrt(dx * dx + dy * dy);
  
  if (DEBUG_UNICORN) {
    console.log("=== UNICORN DECISION ===");
    console.log("Position:", { 
      unicorn: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${at.row},${at.col}` },
      player: { x: player.x.toFixed(1), y: player.y.toFixed(1) },
      delta: { dx: dx.toFixed(1), dy: dy.toFixed(1) },
      distances: { distX: distX.toFixed(1), distY: distY.toFixed(1), total: currentDist.toFixed(1) }
    });
    console.log("Current direction:", { dirX: unicorn.dirX, dirY: unicorn.dirY });
  }
  // Get current tile info for bridge/tunnel restrictions
  const currentTileCode = tileAt(maze, at.row, at.col);
  
  const allDirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];
  const valid = allDirs.filter(dir => {
    const testX = unicorn.x + dir.x * TILE * 0.6;
    const testY = unicorn.y + dir.y * TILE * 0.6;
    const testTile = pixelToGrid(testX, testY);
    const testCode = tileAt(maze, testTile.row, testTile.col);
    
    // Prevent turning from tunnel (layer 1) onto a bridge - bridges don't allow this behavior
    if (unicorn.layer === 1 && testCode === 6) {
      return false; // Can't turn onto a bridge from a tunnel
    }
    
    // If on a bridge (layer 2), prevent turns that violate bridge orientation
    if (currentTileCode === 6 && unicorn.layer === 2) {
      const upTile = tileAt(maze, at.row - 1, at.col);
      const downTile = tileAt(maze, at.row + 1, at.col);
      const leftTile = tileAt(maze, at.row, at.col - 1);
      const rightTile = tileAt(maze, at.row, at.col + 1);
      const isVerticalBridge = (leftTile === 8 || rightTile === 8);
      const isHorizontalBridge = (upTile === 8 || downTile === 8);
      
      // Can't turn horizontal on vertical bridge, or vertical on horizontal bridge
      if (isVerticalBridge && dir.x !== 0) return false;
      if (isHorizontalBridge && dir.y !== 0) return false;
    }
    
    // If on a tunnel, prevent turns that violate tunnel orientation
    if (currentTileCode === 8) {
      const upTile = tileAt(maze, at.row - 1, at.col);
      const downTile = tileAt(maze, at.row + 1, at.col);
      const leftTile = tileAt(maze, at.row, at.col - 1);
      const rightTile = tileAt(maze, at.row, at.col + 1);
      const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
      const isVerticalTunnel = (upTile === 8 || downTile === 8);
      
      // Can't turn vertical on horizontal tunnel, or horizontal on vertical tunnel
      if (isHorizontalTunnel && dir.y !== 0) return false;
      if (isVerticalTunnel && dir.x !== 0) return false;
    }
    
    let testTargetLayer = unicorn.layer;
    if (unicorn.layer === 2 && testCode === 8) testTargetLayer = 1;
    else if (unicorn.layer === 1 && testCode === 0) testTargetLayer = 2;
    return !blocked(maze, testX, testY, unicorn.w, unicorn.h, unicorn.layer, testTargetLayer, dir.x, dir.y, getSwitchAt);
  });

  // Determine intersection/corner status (exclude pure forward/back corridor)
  const reverseDir = { x: -unicorn.dirX, y: -unicorn.dirY };
  const validNonReverse = valid.filter(d => !(d.x === reverseDir.x && d.y === reverseDir.y));
  const isIntersection = validNonReverse.length >= 2; // 3-way or 4-way
  const isCorner = validNonReverse.length === 1 && valid.length >= 2 && !(valid[0].x === -valid[1].x && valid[0].y === -valid[1].y);

  if (DEBUG_UNICORN) {
    const dirName = (d) => {
      if (d.x === 1) return "RIGHT";
      if (d.x === -1) return "LEFT";
      if (d.y === 1) return "DOWN";
      if (d.y === -1) return "UP";
      return "NONE";
    };
    console.log("Valid directions:", {
      all: valid.map(d => dirName(d)),
      nonReverse: validNonReverse.map(d => dirName(d)),
      reverse: dirName(reverseDir),
      isIntersection,
      isCorner,
      randomStepsLeft: randomStepsLeftRef.value,
      lastIntersectionKey: unicorn.lastIntersectionKey,
      currentIntersectionKey: intersectionKey
    });
  }

  // RULE: Only make decisions at intersections and corners
  // If we're not at an intersection/corner and not in random mode, keep current direction
  if (randomStepsLeftRef.value <= 0 && !isIntersection && !isCorner) {
    if (DEBUG_UNICORN) console.log("Decision skipped: not at intersection/corner", { 
      isIntersection, isCorner, randomStepsLeft: randomStepsLeftRef.value 
    });
    // Clear last intersection key when leaving an intersection
    unicorn.lastIntersectionKey = null;
    return false;
  }

  // v1.3: Apply turn delay chance from definition (only applies to non-intersections)
  const shouldDelay = Math.random() < def.movement.turnDelayChance;
  if (shouldDelay && !isIntersection && !isCorner) {
    if (DEBUG_UNICORN) console.log("Decision skipped: turn delay", { shouldDelay, isIntersection, isCorner });
    return false;
  }

  if (randomStepsLeftRef.value > 0) {
    randomStepsLeftRef.value--;
    const pick = valid[Math.floor(Math.random() * valid.length)];
    unicorn.dirX = pick?.x ?? unicorn.dirX;
    unicorn.dirY = pick?.y ?? unicorn.dirY;
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    if (DEBUG_UNICORN) console.log("Decision: RANDOM MODE", { 
      dir: { x: unicorn.dirX, y: unicorn.dirY }, 
      randomStepsLeft: randomStepsLeftRef.value 
    });
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
  // In unicorn_ai debug mode, always chase to test AI behavior
  const chaseMode = MOVEMENT_DEBUG === "unicorn_ai" || gameState !== STATE.PLAYING_INVINCIBLE;
  
  // v1.3: Apply chase/random bias from definition
  const behaviorBias = chaseMode ? def.behavior.chaseBias : (1 - def.behavior.chaseBias); // Invert bias for flee
  const randomChance = def.behavior.randomBias;
  
  if (DEBUG_UNICORN) {
    console.log("Mode:", { 
      chaseMode, 
      gameState, 
      behaviorBias, 
      randomChance,
      dominantAxis: distX > distY ? "horizontal" : "vertical"
    });
  }
  
  // Random movement: only if random chance triggers
  const randomRoll = Math.random();
  if (randomRoll < randomChance) {
    const pick = valid[Math.floor(Math.random() * valid.length)];
    if (pick) {
      unicorn.dirX = pick.x;
      unicorn.dirY = pick.y;
      unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
      if (DEBUG_UNICORN) console.log("Decision: RANDOM CHANCE", { 
        dir: pick, 
        randomRoll: randomRoll.toFixed(3), 
        randomChance 
      });
      return true;
    }
  }
  
  // Chase/flee logic: In chase mode, this should ALWAYS be attempted (not randomly skipped)
  // The behaviorBias was previously used to randomly skip chase, but chase should be the default behavior
  // Calculate primary directions, filtering out zero directions (when player is perfectly aligned)
  const signDx = dx === 0 ? 0 : Math.sign(dx);
  const signDy = dy === 0 ? 0 : Math.sign(dy);
  const primary = chaseMode
    ? (distX > distY
        ? [{ x: signDx, y: 0 }, { x: 0, y: signDy }].filter(d => d.x !== 0 || d.y !== 0)
        : [{ x: 0, y: signDy }, { x: signDx, y: 0 }].filter(d => d.x !== 0 || d.y !== 0))
    : (distX > distY
        ? [{ x: -signDx, y: 0 }, { x: 0, y: -signDy }].filter(d => d.x !== 0 || d.y !== 0)
        : [{ x: 0, y: -signDy }, { x: -signDx, y: 0 }].filter(d => d.x !== 0 || d.y !== 0));

  if (DEBUG_UNICORN) {
    const dirName = (d) => {
      if (d.x === 1) return "RIGHT";
      if (d.x === -1) return "LEFT";
      if (d.y === 1) return "DOWN";
      if (d.y === -1) return "UP";
      return "NONE";
    };
    console.log("Primary chase directions:", {
      primary: primary.map(d => dirName(d)),
      signDx, signDy,
      distX, distY,
      dominantAxis: distX > distY ? "horizontal" : "vertical"
    });
  }

  // Try optimal chase/flee direction first
  if (chooseDir(primary)) {
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    const newDx = player.x - (unicorn.x + unicorn.dirX * TILE);
    const newDy = player.y - (unicorn.y + unicorn.dirY * TILE);
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    const distChange = newDist - currentDist;
    if (DEBUG_UNICORN) console.log("Decision: PRIMARY CHASE", { 
      dir: { x: unicorn.dirX, y: unicorn.dirY }, 
      reason: chaseMode ? "greedy" : "avoid",
      distanceChange: distChange.toFixed(2),
      newDistance: newDist.toFixed(1),
      oldDistance: currentDist.toFixed(1),
      reducesDistance: chaseMode ? (distChange < 0) : (distChange > 0)
    });
    return true;
  }
  
  if (DEBUG_UNICORN) console.log("Primary directions blocked, trying fallback...");

  // Fallback: pick the direction that gets closest to player (or farthest if fleeing)
  // Calculate distance change for each valid direction
  const dirScores = validNonReverse.map(dir => {
    const newX = unicorn.x + dir.x * TILE;
    const newY = unicorn.y + dir.y * TILE;
    const newDx = player.x - newX;
    const newDy = player.y - newY;
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    const distChange = newDist - currentDist;
    return {
      dir,
      dist: newDist,
      distChange,
      reducesDistance: chaseMode ? (newDist < currentDist) : (newDist > currentDist)
    };
  });

  if (DEBUG_UNICORN) {
    const dirName = (d) => {
      if (d.x === 1) return "RIGHT";
      if (d.x === -1) return "LEFT";
      if (d.y === 1) return "DOWN";
      if (d.y === -1) return "UP";
      return "NONE";
    };
    console.log("Direction scores:", dirScores.map(d => ({
      dir: dirName(d.dir),
      distance: d.dist.toFixed(1),
      change: d.distChange.toFixed(2),
      reducesDistance: d.reducesDistance
    })));
  }

  // In chase mode, prefer directions that reduce distance; in flee mode, prefer directions that increase distance
  const preferredDirs = dirScores.filter(d => d.reducesDistance);
  if (preferredDirs.length > 0) {
    // Pick the direction that reduces/increases distance the most
    const bestDir = preferredDirs.sort((a, b) => chaseMode ? (a.dist - b.dist) : (b.dist - a.dist))[0];
    unicorn.dirX = bestDir.dir.x;
    unicorn.dirY = bestDir.dir.y;
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    if (DEBUG_UNICORN) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      console.log("Decision: FALLBACK (best distance)", { 
        dir: { x: unicorn.dirX, y: unicorn.dirY },
        dirName: dirName(bestDir.dir),
        reason: chaseMode ? "greedy-fallback" : "avoid-fallback",
        distanceChange: bestDir.distChange.toFixed(2),
        newDistance: bestDir.dist.toFixed(1),
        oldDistance: currentDist.toFixed(1),
        alternatives: preferredDirs.length
      });
    }
    return true;
  }

  // Last resort: any valid non-reverse, else any valid
  const pick = (validNonReverse[0] ?? valid[0]);
  if (pick) {
    unicorn.dirX = pick.x;
    unicorn.dirY = pick.y;
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    const newDx = player.x - (unicorn.x + unicorn.dirX * TILE);
    const newDy = player.y - (unicorn.y + unicorn.dirY * TILE);
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    const distChange = newDist - currentDist;
    if (DEBUG_UNICORN) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      console.log("Decision: LAST RESORT", { 
        dir: pick,
        dirName: dirName(pick),
        reason: "fallback",
        distanceChange: distChange.toFixed(2),
        newDistance: newDist.toFixed(1),
        oldDistance: currentDist.toFixed(1),
        warning: "No direction reduces distance!"
      });
    }
    return true;
  }
  
  if (DEBUG_UNICORN) console.log("Decision: FAILED - no valid directions");
  return false;
}

export function updateUnicorn(dt, unicorn, player, maze, switches, portals, gameState, unicornRespawnPauseRef, randomStepsLeftRef, unicornTrail, unicornStars, invincibleTimer, getSwitchAt) {
  // Don't process movement during portal animation
  if (unicorn.portalAnimating) {
    return;
  }
  
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
      if (aheadCode === 6 && unicorn.layer === 2) {
        // Bridge blocks movement (only on layer 2) - check orientation
        const upTile = tileAt(maze, aheadTile.row - 1, aheadTile.col);
        const downTile = tileAt(maze, aheadTile.row + 1, aheadTile.col);
        const leftTile = tileAt(maze, aheadTile.row, aheadTile.col - 1);
        const rightTile = tileAt(maze, aheadTile.row, aheadTile.col + 1);
        const isVerticalBridge = (leftTile === 8 || rightTile === 8);
        if (isVerticalBridge && unicorn.dirX !== 0) willBeBlocked = true;
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

  // Determine target layer - check if we should transition before checking collisions
  const targetTile = pixelToGrid(unicorn.x + moveX, unicorn.y + moveY);
  const targetCode = tileAt(maze, targetTile.row, targetTile.col);
  let targetLayer = unicorn.layer;
  if (unicorn.layer === 2 && targetCode === 8) {
    // Transitioning from floor (layer 2) to tunnel (layer 1)
    targetLayer = 1;
  } else if (unicorn.layer === 1 && targetCode === 0) {
    // Transitioning from tunnel (layer 1) to floor (layer 2)
    targetLayer = 2;
  }
  // Note: Bridges (tile 6) don't cause layer transitions
  
  // Update unicorn layer if transitioning
  if (targetLayer !== unicorn.layer) {
    unicorn.layer = targetLayer;
  }

  // Bridges & switches: unicorn must respect the same directional blocks as the player
  // BUT: Only apply bridge restrictions when on layer 2 (walking over bridge)
  // On layer 1 (tunnel layer), bridges don't restrict movement (you pass under them)
  const currentTile = pixelToGrid(unicorn.x, unicorn.y);
  const currentCode = tileAt(maze, currentTile.row, currentTile.col);
  
  if (currentCode === 6 && unicorn.layer === 2) {
    // On a bridge on layer 2 - check orientation and restrict movement
    const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
    const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
    const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
    const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
    const isVerticalBridge = (leftTile === 8 || rightTile === 8);
    const isHorizontalBridge = (upTile === 8 || downTile === 8);
    
    if (isVerticalBridge && moveX !== 0) {
      moveX = 0;
    } else if (isHorizontalBridge && moveY !== 0) {
      moveY = 0;
    }
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
  // BUT: Only apply bridge restrictions when on layer 2
  if (targetCode === 6 && unicorn.layer === 2) {
    const upTile = tileAt(maze, targetTile.row - 1, targetTile.col);
    const downTile = tileAt(maze, targetTile.row + 1, targetTile.col);
    const leftTile = tileAt(maze, targetTile.row, targetTile.col - 1);
    const rightTile = tileAt(maze, targetTile.row, targetTile.col + 1);
    const isVerticalBridge = (leftTile === 8 || rightTile === 8);
    const isHorizontalBridge = (upTile === 8 || downTile === 8);
    
    if (isVerticalBridge && moveX !== 0) {
      moveX = 0;
    } else if (isHorizontalBridge && moveY !== 0) {
      moveY = 0;
    }
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

  // Check collisions with layer awareness (use target layer for movement checks, allow transition)
  // Switches now block like walls - handled inside blocked() function
  const wouldBlockX = blocked(maze, unicorn.x + moveX, unicorn.y, unicorn.w, unicorn.h, unicorn.layer, targetLayer, unicorn.dirX, 0, getSwitchAt);
  const wouldBlockY = blocked(maze, unicorn.x, unicorn.y + moveY, unicorn.w, unicorn.h, unicorn.layer, targetLayer, 0, unicorn.dirY, getSwitchAt);
  
  // Apply movement only if not blocked by walls or switches
  if (!wouldBlockX) unicorn.x += moveX;
  if (!wouldBlockY) unicorn.y += moveY;
  
  // Stop on collision but keep direction for next intersection
  // Treat switches exactly like walls - zero direction in blocked axis
  if (wouldBlockX) {
    unicorn.dirX = 0;
  }
  if (wouldBlockY) {
    unicorn.dirY = 0;
  }

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
      if (!blocked(maze, testX, testY, unicorn.w, unicorn.h, unicorn.layer, null, dir.x, dir.y, getSwitchAt)) {
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

