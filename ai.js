// v1.3.0 - Unicorn AI logic

import { TILE, RANDOM_INTERSECTION_COUNT, STATE, DEBUG_UNICORN, UNICORN_SPEED, MOVEMENT_DEBUG, DEBUG_TUNNELS } from './config.js';
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
  
  // CRITICAL RULE: Unicorns cannot make ANY direction decisions on bridges or in tunnels
  // They must continue straight until they exit naturally - same rules as player
  const currentTileCode = tileAt(maze, at.row, at.col);
  
  // BLOCK ALL decisions when:
  // - On a bridge (layer 2, code 6)
  // - In a tunnel (any layer, code 8)
  // - Under a bridge (layer 1, code 6) - also cannot turn
  const isOnBridge = currentTileCode === 6 && unicorn.layer === 2;
  const isInTunnel = currentTileCode === 8;
  const isUnderBridge = currentTileCode === 6 && unicorn.layer === 1;
  
  if (isOnBridge || isInTunnel || isUnderBridge) {
    if (DEBUG_TUNNELS || DEBUG_UNICORN) {
      const upTile = tileAt(maze, at.row - 1, at.col);
      const downTile = tileAt(maze, at.row + 1, at.col);
      const leftTile = tileAt(maze, at.row, at.col - 1);
      const rightTile = tileAt(maze, at.row, at.col + 1);
      
      let orientation = "Unknown";
      let tileType = "";
      if (isOnBridge) {
        tileType = "Bridge (on top)";
        const isVerticalBridge = (leftTile === 8 || rightTile === 8);
        const isHorizontalBridge = (upTile === 8 || downTile === 8);
        orientation = isVerticalBridge ? "Vertical" : isHorizontalBridge ? "Horizontal" : "Unknown";
      } else if (isInTunnel) {
        tileType = "Tunnel";
        const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
        const isVerticalTunnel = (upTile === 8 || downTile === 8);
        orientation = isHorizontalTunnel ? "Horizontal" : isVerticalTunnel ? "Vertical" : "Unknown";
      } else if (isUnderBridge) {
        tileType = "Bridge (under)";
        orientation = "N/A (under bridge)";
      }
      
      console.log("Unicorn decision BLOCKED: on bridge/tunnel/under bridge, must continue straight", {
        position: { x: unicorn.x, y: unicorn.y, grid: `${at.row},${at.col}` },
        currentDirection: { x: unicorn.dirX, y: unicorn.dirY },
        tileType: tileType,
        orientation: orientation,
        layer: unicorn.layer,
        rule: "No decisions allowed on bridges, in tunnels, or under bridges - must continue until exit"
      });
    }
    return false; // BLOCK ALL decisions - must continue straight
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
  // Get current tile info for bridge/tunnel restrictions (already retrieved above)
  
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

  // Track turn attempts in tunnels (should not happen)
  if (DEBUG_TUNNELS && (currentTileCode === 8 || unicorn.layer === 1)) {
    const upTile = tileAt(maze, at.row - 1, at.col);
    const downTile = tileAt(maze, at.row + 1, at.col);
    const leftTile = tileAt(maze, at.row, at.col - 1);
    const rightTile = tileAt(maze, at.row, at.col + 1);
    const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
    const isVerticalTunnel = (upTile === 8 || downTile === 8);
    
    const dirName = (d) => {
      if (d.x === 1) return "RIGHT";
      if (d.x === -1) return "LEFT";
      if (d.y === 1) return "DOWN";
      if (d.y === -1) return "UP";
      return "NONE";
    };
    
    const currentDirName = dirName({ x: unicorn.dirX, y: unicorn.dirY });
    const wantsToTurn = isIntersection || isCorner;
    
    if (wantsToTurn) {
      console.log("=== UNICORN TURN ATTEMPT IN TUNNEL ===", {
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${at.row},${at.col}` },
        layer: unicorn.layer,
        currentTileCode: currentTileCode,
        tunnelOrientation: isHorizontalTunnel ? "Horizontal" : isVerticalTunnel ? "Vertical" : "Unknown",
        currentDirection: { x: unicorn.dirX, y: unicorn.dirY, name: currentDirName },
        validDirections: validNonReverse.map(d => dirName(d)),
        isIntersection,
        isCorner,
        warning: "Unicorn trying to turn in tunnel - this should be restricted!",
        neighbors: { up: upTile, down: downTile, left: leftTile, right: rightTile }
      });
    }
  }

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
  const oldDirXBeforePrimary = unicorn.dirX;
  const oldDirYBeforePrimary = unicorn.dirY;
  if (chooseDir(primary)) {
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    const newDx = player.x - (unicorn.x + unicorn.dirX * TILE);
    const newDy = player.y - (unicorn.y + unicorn.dirY * TILE);
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    const distChange = newDist - currentDist;
    
    // Track if this is a turn in a tunnel (should not happen)
    if (DEBUG_TUNNELS && (currentTileCode === 8 || unicorn.layer === 1) && (oldDirXBeforePrimary !== unicorn.dirX || oldDirYBeforePrimary !== unicorn.dirY)) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      console.log("=== UNICORN TURNED IN TUNNEL ===", {
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${at.row},${at.col}` },
        layer: unicorn.layer,
        currentTileCode: currentTileCode,
        oldDirection: { x: oldDirXBeforePrimary, y: oldDirYBeforePrimary, name: dirName({ x: oldDirXBeforePrimary, y: oldDirYBeforePrimary }) },
        newDirection: { x: unicorn.dirX, y: unicorn.dirY, name: dirName({ x: unicorn.dirX, y: unicorn.dirY }) },
        decisionType: "PRIMARY CHASE",
        warning: "Unicorn made a turn decision while in tunnel - check if this is valid!"
      });
    }
    
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
    const oldDirX = unicorn.dirX;
    const oldDirY = unicorn.dirY;
    unicorn.dirX = bestDir.dir.x;
    unicorn.dirY = bestDir.dir.y;
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    
    // Track if this is a turn in a tunnel (should not happen)
    if (DEBUG_TUNNELS && (currentTileCode === 8 || unicorn.layer === 1) && (oldDirX !== unicorn.dirX || oldDirY !== unicorn.dirY)) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      console.log("=== UNICORN TURNED IN TUNNEL ===", {
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${at.row},${at.col}` },
        layer: unicorn.layer,
        currentTileCode: currentTileCode,
        oldDirection: { x: oldDirX, y: oldDirY, name: dirName({ x: oldDirX, y: oldDirY }) },
        newDirection: { x: unicorn.dirX, y: unicorn.dirY, name: dirName({ x: unicorn.dirX, y: unicorn.dirY }) },
        decisionType: "FALLBACK (best distance)",
        warning: "Unicorn made a turn decision while in tunnel - check if this is valid!"
      });
    }
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
    const oldDirX = unicorn.dirX;
    const oldDirY = unicorn.dirY;
    unicorn.dirX = pick.x;
    unicorn.dirY = pick.y;
    unicorn.lastIntersectionKey = intersectionKey; // Mark this intersection as visited
    
    // Track if this is a turn in a tunnel (should not happen)
    if (DEBUG_TUNNELS && (currentTileCode === 8 || unicorn.layer === 1) && (oldDirX !== unicorn.dirX || oldDirY !== unicorn.dirY)) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      console.log("=== UNICORN TURNED IN TUNNEL ===", {
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${at.row},${at.col}` },
        layer: unicorn.layer,
        currentTileCode: currentTileCode,
        oldDirection: { x: oldDirX, y: oldDirY, name: dirName({ x: oldDirX, y: oldDirY }) },
        newDirection: { x: unicorn.dirX, y: unicorn.dirY, name: dirName({ x: unicorn.dirX, y: unicorn.dirY }) },
        decisionType: "LAST RESORT",
        warning: "Unicorn made a turn decision while in tunnel - check if this is valid!"
      });
    }
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
  const prevDirX = unicorn.dirX;
  const prevDirY = unicorn.dirY;

  chooseUnicornDir(unicorn, player, maze, gameState, randomStepsLeftRef, getSwitchAt);
  
  // CRITICAL: Validate that unicorn is not turning on bridges or in tunnels
  // If it tries to turn, pause the game with debug info
  const currentTile = pixelToGrid(unicorn.x, unicorn.y);
  const currentCode = tileAt(maze, currentTile.row, currentTile.col);
  const directionChanged = (prevDirX !== unicorn.dirX || prevDirY !== unicorn.dirY);
  
  // Check for violations: turning on bridge (layer 2) or in tunnel (any layer) or under bridge (layer 1)
  const isOnBridge = currentCode === 6 && unicorn.layer === 2;
  const isInTunnel = currentCode === 8;
  const isUnderBridge = currentCode === 6 && unicorn.layer === 1;
  
  if (directionChanged && (isOnBridge || isInTunnel || isUnderBridge)) {
    const dirName = (d) => {
      if (d.x === 1) return "RIGHT";
      if (d.x === -1) return "LEFT";
      if (d.y === 1) return "DOWN";
      if (d.y === -1) return "UP";
      return "NONE";
    };
    
    const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
    const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
    const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
    const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
    
    let violationType = "";
    let orientation = "";
    
    if (isOnBridge) {
      // On a bridge (layer 2)
      const isVerticalBridge = (leftTile === 8 || rightTile === 8);
      const isHorizontalBridge = (upTile === 8 || downTile === 8);
      orientation = isVerticalBridge ? "Vertical" : isHorizontalBridge ? "Horizontal" : "Unknown";
      violationType = "TURN ON BRIDGE";
    } else if (isInTunnel) {
      // In a tunnel
      const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
      const isVerticalTunnel = (upTile === 8 || downTile === 8);
      orientation = isHorizontalTunnel ? "Horizontal" : isVerticalTunnel ? "Vertical" : "Unknown";
      violationType = "TURN IN TUNNEL";
    } else if (isUnderBridge) {
      // Under a bridge (layer 1) - also cannot turn
      violationType = "TURN UNDER BRIDGE";
      orientation = "N/A (under bridge)";
    }
    
    // Check if it's a 90-degree turn
    const wasHorizontal = prevDirX !== 0 && prevDirY === 0;
    const wasVertical = prevDirY !== 0 && prevDirX === 0;
    const isHorizontal = unicorn.dirX !== 0 && unicorn.dirY === 0;
    const isVertical = unicorn.dirY !== 0 && unicorn.dirX === 0;
    const is90DegreeTurn = (wasHorizontal && isVertical) || (wasVertical && isHorizontal);
    
    const errorInfo = {
      violation: violationType,
      position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${currentTile.row},${currentTile.col}` },
      layer: unicorn.layer,
      currentTileCode: currentCode,
      tileName: isOnBridge ? "Bridge (on top)" : isInTunnel ? "Tunnel" : "Bridge (under)",
      orientation: orientation,
      oldDirection: { x: prevDirX, y: prevDirY, name: dirName({ x: prevDirX, y: prevDirY }) },
      newDirection: { x: unicorn.dirX, y: unicorn.dirY, name: dirName({ x: unicorn.dirX, y: unicorn.dirY }) },
      is90DegreeTurn: is90DegreeTurn,
      neighbors: { up: upTile, down: downTile, left: leftTile, right: rightTile },
      error: "UNICORN VIOLATED BRIDGE/TUNNEL RULE - GAME PAUSED",
      rule: "Unicorns must continue straight on bridges and in tunnels until they exit naturally"
    };
    
    console.error("=== UNICORN BRIDGE/TUNNEL VIOLATION - GAME PAUSED ===", errorInfo);
    console.error("Unicorns must continue straight on bridges and in tunnels until they exit naturally!");
    console.error("This should never happen - check AI decision logic!");
    
    // Return pause signal to game.js
    return { 
      pauseGame: true, 
      violationInfo: errorInfo 
    };
  }
  
  // Track 90-degree turns while on layer 1 (tunnel layer) - for logging only
  if (DEBUG_TUNNELS && unicorn.layer === 1 && directionChanged) {
    const wasHorizontal = prevDirX !== 0 && prevDirY === 0;
    const wasVertical = prevDirY !== 0 && prevDirX === 0;
    const isHorizontal = unicorn.dirX !== 0 && unicorn.dirY === 0;
    const isVertical = unicorn.dirY !== 0 && unicorn.dirX === 0;
    
    // 90-degree turn: changing from horizontal to vertical or vice versa
    const is90DegreeTurn = (wasHorizontal && isVertical) || (wasVertical && isHorizontal);
    
    if (is90DegreeTurn) {
      const dirName = (d) => {
        if (d.x === 1) return "RIGHT";
        if (d.x === -1) return "LEFT";
        if (d.y === 1) return "DOWN";
        if (d.y === -1) return "UP";
        return "NONE";
      };
      
      console.log("=== UNICORN 90° TURN ON TUNNEL LAYER ===", {
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${currentTile.row},${currentTile.col}` },
        layer: unicorn.layer,
        currentTileCode: currentCode,
        oldDirection: { x: prevDirX, y: prevDirY, name: dirName({ x: prevDirX, y: prevDirY }) },
        newDirection: { x: unicorn.dirX, y: unicorn.dirY, name: dirName({ x: unicorn.dirX, y: unicorn.dirY }) },
        turnType: wasHorizontal ? "Horizontal → Vertical" : "Vertical → Horizontal",
        warning: "90-degree turn detected on tunnel layer - tunnels only allow movement in one direction!"
      });
    }
  }
  
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

  // Note: currentTile and currentCode already declared above for violation checking
  // Position should be the same, so we can reuse those variables

  // Determine target layer - check if we should transition before checking collisions
  const targetTile = pixelToGrid(unicorn.x + moveX, unicorn.y + moveY);
  const targetCode = tileAt(maze, targetTile.row, targetTile.col);
  let targetLayer = unicorn.layer;
  if (unicorn.layer === 2 && targetCode === 8) {
    // Transitioning from floor (layer 2) to tunnel (layer 1)
    targetLayer = 1;
  } else if (unicorn.layer === 1 && currentCode === 8 && targetCode === 0) {
    // Transitioning from tunnel (layer 1) to floor (layer 2)
    // IMPORTANT: Only transition when CURRENTLY on a tunnel tile (code 8), not when under a bridge (code 6)
    // This ensures we only exit the tunnel when actually leaving a tunnel entrance, not when passing under a bridge
    targetLayer = 2;
  }
  // Note: Bridges (tile 6) don't cause layer transitions
  // - On layer 1, bridges are passed under (stay on layer 1)
  // - On layer 2, bridges are walked over (stay on layer 2)
  // - When under a bridge (layer 1, code 6), moving to floor (code 0) should NOT transition - stay on layer 1
  
  // Debug tunnel state BEFORE layer transition (to show state before change)
  if (DEBUG_TUNNELS && currentCode === 8) {
    const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
    const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
    const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
    const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
    const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
    const isVerticalTunnel = (upTile === 8 || downTile === 8);
    
    console.log("=== UNICORN IN TUNNEL ===", {
      position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${currentTile.row},${currentTile.col}` },
      layer: unicorn.layer,
      layerName: unicorn.layer === 1 ? "Tunnel (1)" : "Floor (2)",
      orientation: isHorizontalTunnel ? "Horizontal" : isVerticalTunnel ? "Vertical" : "Unknown",
      neighbors: { up: upTile, down: downTile, left: leftTile, right: rightTile },
      movement: { moveX: moveX.toFixed(2), moveY: moveY.toFixed(2), dirX: unicorn.dirX, dirY: unicorn.dirY },
      restrictions: {
        horizontalTunnel: isHorizontalTunnel,
        verticalTunnel: isVerticalTunnel,
        note: "Unicorn tunnel restrictions handled in AI decision logic"
      }
    });
  } else if (DEBUG_TUNNELS && unicorn.layer === 1 && currentCode !== 8) {
    // Unicorn is on layer 1 (tunnel layer) but not on a tunnel tile (might be under a bridge)
    console.log("=== UNICORN ON TUNNEL LAYER (not on tunnel tile) ===", {
      position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1), grid: `${currentTile.row},${currentTile.col}` },
      layer: unicorn.layer,
      currentTileCode: currentCode,
      note: currentCode === 6 ? "Under bridge" : "Other tile",
      targetTile: { row: targetTile.row, col: targetTile.col, code: targetCode },
      willTransition: targetLayer !== unicorn.layer
    });
  }

  // Update unicorn layer if transitioning
  if (targetLayer !== unicorn.layer) {
    if (DEBUG_TUNNELS) {
      let reason = "Other";
      if (unicorn.layer === 2 && targetCode === 8) {
        reason = "Entering tunnel (floor → tunnel)";
      } else if (unicorn.layer === 1 && targetCode === 0) {
        reason = "Exiting tunnel to floor (tunnel → floor)";
        if (currentCode === 6) {
          reason += " - was under bridge";
        } else if (currentCode === 8) {
          reason += " - was in tunnel";
        }
      }
      
      console.log("=== UNICORN LAYER TRANSITION ===", {
        from: unicorn.layer === 1 ? "Tunnel (1)" : "Floor (2)",
        to: targetLayer === 1 ? "Tunnel (1)" : "Floor (2)",
        currentTile: { row: currentTile.row, col: currentTile.col, code: currentCode, name: currentCode === 6 ? "Bridge" : currentCode === 8 ? "Tunnel" : currentCode === 0 ? "Floor" : "Other" },
        targetTile: { row: targetTile.row, col: targetTile.col, code: targetCode, name: targetCode === 6 ? "Bridge" : targetCode === 8 ? "Tunnel" : targetCode === 0 ? "Floor" : "Other" },
        position: { x: unicorn.x.toFixed(1), y: unicorn.y.toFixed(1) },
        reason: reason,
        movement: { moveX: moveX.toFixed(2), moveY: moveY.toFixed(2), dirX: unicorn.dirX, dirY: unicorn.dirY }
      });
    }
    unicorn.layer = targetLayer;
  }

  // Bridges & switches: unicorn must respect the same directional blocks as the player
  // BUT: Only apply bridge restrictions when on layer 2 (walking over bridge)
  // On layer 1 (tunnel layer), bridges don't restrict movement (you pass under them)
  
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

