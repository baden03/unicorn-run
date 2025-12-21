// v1.2.1 - Movement logic

import { TILE, COLS, DEBUG_PORTALS } from './config.js';
import { pixelToGrid, gridToPixel, blocked, tileAt, isPortal, getTileMetadata, tileExistsOnLayer } from './utils.js';

export function applyPortal(entity, maze, portals) {
  const { row, col } = pixelToGrid(entity.x, entity.y);
  if (!isPortal(maze, row, col)) {
    // Reset last portal tracking when not on a portal
    if (entity.lastPortalRow !== null || entity.lastPortalCol !== null) {
      entity.lastPortalRow = null;
      entity.lastPortalCol = null;
    }
    return;
  }

  // Prevent infinite loop: don't teleport if we just came from this portal
  if (entity.lastPortalRow === row && entity.lastPortalCol === col) {
    return;
  }

  // Check if player is deep enough into the portal tile (within TILE/8 of center)
  const tileCenter = gridToPixel(col, row);
  const distFromCenter = Math.sqrt(
    Math.pow(entity.x - tileCenter.x, 2) + 
    Math.pow(entity.y - tileCenter.y, 2)
  );
  const triggerDistance = TILE / 8; // Require player to be very close to center (within 12.5% of tile size)
  
  if (distFromCenter > triggerDistance) {
    // Not far enough into the portal yet
    return;
  }

  // Find the portal pair - this works for all portals including side portals
  const pair = portals.find(
    (p) =>
      (p.a.row === row && p.a.col === col) ||
      (p.b.row === row && p.b.col === col)
  );
  
  // If no pair found, fall back to old edge portal behavior for backwards compatibility
  if (!pair) {
    const mazeCols = maze[0]?.length || 0;
    if (col === 0 || col === mazeCols - 1) {
      const targetCol = col === 0 ? mazeCols - 2 : 1;
      const pos = gridToPixel(targetCol, row);
      entity.x = pos.x;
      entity.y = pos.y;
      // Track the portal we just teleported to
      entity.lastPortalRow = row;
      entity.lastPortalCol = targetCol;
      if (DEBUG_PORTALS) {
        console.log("Side portal wrap (fallback)", { from: { row, col }, to: { row, col: targetCol } });
      }
      return;
    }
    return;
  }

  // Special handling for bridge portals:
  // if the pair is symmetric around a bridge (same row, cols differ by 2),
  // tunnel *through* the bridge: from one portal, skip the bridge and opposite
  // portal and land on the next free tile on the far side.
  if (pair.a.row === pair.b.row && Math.abs(pair.a.col - pair.b.col) === 2) {
    const bridgeRow = pair.a.row;
    const bridgeCol = (pair.a.col + pair.b.col) / 2;

    // Determine which side we're entering from and move two tiles past the bridge center
    const dir = Math.sign(bridgeCol - col); // from left (+1) or right (-1)
    const targetCol = bridgeCol + dir * 2;
    const pos = gridToPixel(targetCol, bridgeRow);
    entity.x = pos.x;
    entity.y = pos.y;
    // Track the portal we just teleported to (the target tile, not the portal itself)
    entity.lastPortalRow = null;
    entity.lastPortalCol = null;
    if (DEBUG_PORTALS) {
      console.log("Bridge portal -> far side tile", {
        from: { row, col },
        bridge: { row: bridgeRow, col: bridgeCol },
        to: { row: bridgeRow, col: targetCol },
      });
    }
    return;
  }

  // Generic paired portals: start animation, then teleport to the other portal tile
  const target = (pair.a.row === row && pair.a.col === col) ? pair.b : pair.a;
  const pos = gridToPixel(target.col, target.row);
  
  // Start portal animation instead of instant teleport
  if (!entity.portalAnimating) {
    entity.portalAnimating = true;
    entity.portalAnimProgress = 0;
    entity.portalTargetX = pos.x;
    entity.portalTargetY = pos.y;
    if (DEBUG_PORTALS) {
      console.log("Paired portal - starting animation", { from: { row, col }, to: target });
    }
  }
}

export function updatePlayer(dt, player, maze, switches, portals, keys, joystickState, getSwitchAt) {
  // Don't process movement during portal animation
  if (player.portalAnimating) {
    return;
  }
  
  // Capture input once; movement persists even when keys are released.
  let inputX = 0, inputY = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX = -1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) inputX = 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) inputY = -1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) inputY = 1;

  const js = joystickState.left.active ? joystickState.left : joystickState.right;
  if (js?.active && (js.dx || js.dy)) { inputX = js.dx; inputY = js.dy; }

  // Axis-only input
  if (inputX && inputY) inputY = 0;

  // Update desired direction when any input is present
  if (inputX !== 0 || inputY !== 0) {
    player.desiredX = inputX;
    player.desiredY = inputY;
  }

  // Snap lightly on the idle axis to help turns
  const grid = pixelToGrid(player.x, player.y);
  const center = gridToPixel(grid.col, grid.row);
  const turnSnap = TILE * 0.3;
  if (player.dirX === 0 && Math.abs(player.x - center.x) < turnSnap) player.x = center.x;
  if (player.dirY === 0 && Math.abs(player.y - center.y) < turnSnap) player.y = center.y;

  // Get current tile info early for bridge/tunnel checks
  const currentTile = pixelToGrid(player.x, player.y);
  const currentTileCode = tileAt(maze, currentTile.row, currentTile.col);

  // If near center and desired differs, try to turn
  const nearCenter = Math.abs(player.x - center.x) < turnSnap && Math.abs(player.y - center.y) < turnSnap;
  const wantsTurn = (player.desiredX !== player.dirX || player.desiredY !== player.dirY);
  if (nearCenter && (player.desiredX !== 0 || player.desiredY !== 0) && wantsTurn) {
    // Check if we're on a bridge or tunnel that would prevent this turn
    let canTurn = true;
    
    if (currentTileCode === 6) {
      // On a bridge - check orientation
      const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
      const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
      const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
      const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
      const isVerticalBridge = (leftTile === 8 || rightTile === 8);
      const isHorizontalBridge = (upTile === 8 || downTile === 8);
      
      if (isVerticalBridge && player.desiredX !== 0) canTurn = false; // Can't turn horizontal on vertical bridge
      if (isHorizontalBridge && player.desiredY !== 0) canTurn = false; // Can't turn vertical on horizontal bridge
    } else if (currentTileCode === 8) {
      // On a tunnel - check orientation
      const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
      const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
      const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
      const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
      const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
      const isVerticalTunnel = (upTile === 8 || downTile === 8);
      
      if (isHorizontalTunnel && player.desiredY !== 0) canTurn = false; // Can't turn vertical on horizontal tunnel
      if (isVerticalTunnel && player.desiredX !== 0) canTurn = false; // Can't turn horizontal on vertical tunnel
    }
    
    if (canTurn) {
      const testX = center.x + player.desiredX * TILE * 0.4;
      const testY = center.y + player.desiredY * TILE * 0.4;
      const testTile = pixelToGrid(testX, testY);
      const testCode = tileAt(maze, testTile.row, testTile.col);
      
      // Prevent turning from tunnel (layer 1) onto a bridge - bridges don't allow this behavior
      if (player.layer === 1 && testCode === 6) {
        canTurn = false; // Can't turn onto a bridge from a tunnel
      }
      
      if (canTurn) {
        let testTargetLayer = player.layer;
        if (player.layer === 2 && testCode === 8) testTargetLayer = 1;
        else if (player.layer === 1 && testCode === 0) testTargetLayer = 2;
        if (!blocked(maze, testX, testY, player.w, player.h, player.layer, testTargetLayer)) {
          player.dirX = player.desiredX;
          player.dirY = player.desiredY;
        }
      }
    }
  }

  // If we're stopped but have a desired direction, try to start moving
  if (player.dirX === 0 && player.dirY === 0 && (player.desiredX !== 0 || player.desiredY !== 0)) {
    // Check if we're on a bridge or tunnel that would prevent this movement
    let canStart = true;
    
    if (currentTileCode === 6) {
      // On a bridge - check orientation
      const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
      const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
      const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
      const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
      const isVerticalBridge = (leftTile === 8 || rightTile === 8);
      const isHorizontalBridge = (upTile === 8 || downTile === 8);
      
      if (isVerticalBridge && player.desiredX !== 0) canStart = false; // Can't start horizontal on vertical bridge
      if (isHorizontalBridge && player.desiredY !== 0) canStart = false; // Can't start vertical on horizontal bridge
    } else if (currentTileCode === 8) {
      // On a tunnel - check orientation
      // Tunnels can be horizontal (left-right) or vertical (up-down)
      // But we also need to allow movement into bridges (which are adjacent to tunnels)
      const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
      const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
      const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
      const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
      
      // Check if there are tunnels or bridges in the horizontal direction
      const hasHorizontalPath = (leftTile === 8 || leftTile === 6 || rightTile === 8 || rightTile === 6);
      // Check if there are tunnels or bridges in the vertical direction
      const hasVerticalPath = (upTile === 8 || upTile === 6 || downTile === 8 || downTile === 6);
      
      // If there's a horizontal path (tunnel or bridge), only allow horizontal movement
      if (hasHorizontalPath && !hasVerticalPath && player.desiredY !== 0) {
        canStart = false; // Can't start vertical on horizontal tunnel/bridge path
      }
      // If there's a vertical path (tunnel or bridge), only allow vertical movement
      if (hasVerticalPath && !hasHorizontalPath && player.desiredX !== 0) {
        canStart = false; // Can't start horizontal on vertical tunnel/bridge path
      }
    }
    
    if (canStart) {
      const testX = player.x + player.desiredX * TILE * 0.4;
      const testY = player.y + player.desiredY * TILE * 0.4;
      const testTile = pixelToGrid(testX, testY);
      const testCode = tileAt(maze, testTile.row, testTile.col);
      let testTargetLayer = player.layer;
      if (player.layer === 2 && testCode === 8) testTargetLayer = 1;
      else if (player.layer === 1 && testCode === 0) testTargetLayer = 2;
      // Bridges (tile 6) don't cause layer transitions - stay on current layer
      
      if (!blocked(maze, testX, testY, player.w, player.h, player.layer, testTargetLayer)) {
        player.dirX = player.desiredX;
        player.dirY = player.desiredY;
      }
    }
  }

  // Move using current direction (persists without holding keys)
  let moveX = player.dirX * player.speed * dt;
  let moveY = player.dirY * player.speed * dt;

  // Tile-based special rules (currentTile and currentTileCode already defined above)
  const targetTile = pixelToGrid(player.x + moveX, player.y + moveY);
  const targetCode = tileAt(maze, targetTile.row, targetTile.col);

  // Determine target layer - check if we should transition before checking collisions
  let targetLayer = player.layer;
  if (player.layer === 2 && targetCode === 8) {
    // Transitioning from floor (layer 2) to tunnel (layer 1)
    targetLayer = 1;
  } else if (player.layer === 1 && targetCode === 0) {
    // Transitioning from tunnel (layer 1) to floor (layer 2)
    targetLayer = 2;
  }
  // Note: Bridges (tile 6) don't cause layer transitions
  // - On layer 1, bridges don't exist, so we pass under them (stay on layer 1)
  // - On layer 2, bridges exist, so we walk over them (stay on layer 2)
  
  // Update player layer if transitioning
  if (targetLayer !== player.layer) {
    player.layer = targetLayer;
  }

  // Bridge movement restrictions: determine orientation and restrict movement
  // Vertical bridge: tunnels on left/right, only allow vertical (up/down) movement
  // Horizontal bridge: tunnels on top/bottom, only allow horizontal (left/right) movement
  // BUT: Only apply when on layer 2 (walking over bridge). On layer 1, you pass under.
  if (currentTileCode === 6 && player.layer === 2) {
    // Check adjacent tiles to determine bridge orientation
    const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
    const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
    const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
    const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
    
    // If tunnels are on left/right, it's a vertical bridge (allow only vertical movement)
    const isVerticalBridge = (leftTile === 8 || rightTile === 8);
    // If tunnels are on top/bottom, it's a horizontal bridge (allow only horizontal movement)
    const isHorizontalBridge = (upTile === 8 || downTile === 8);
    
    if (isVerticalBridge && moveX !== 0) {
      // Vertical bridge: block horizontal movement
      moveX = 0;
      player.dirX = 0;
    } else if (isHorizontalBridge && moveY !== 0) {
      // Horizontal bridge: block vertical movement
      moveY = 0;
      player.dirY = 0;
    }
  }

  // Tunnel movement restrictions: determine orientation and restrict movement
  // Horizontal tunnel (same row): only allow horizontal (left/right) movement
  // Vertical tunnel (same column): only allow vertical (up/down) movement
  if (currentTileCode === 8) {
    // Check adjacent tiles to determine tunnel orientation
    const upTile = tileAt(maze, currentTile.row - 1, currentTile.col);
    const downTile = tileAt(maze, currentTile.row + 1, currentTile.col);
    const leftTile = tileAt(maze, currentTile.row, currentTile.col - 1);
    const rightTile = tileAt(maze, currentTile.row, currentTile.col + 1);
    
    // If adjacent tunnels are on left/right, it's a horizontal tunnel
    const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
    // If adjacent tunnels are on top/bottom, it's a vertical tunnel
    const isVerticalTunnel = (upTile === 8 || downTile === 8);
    
    if (isHorizontalTunnel && moveY !== 0) {
      // Horizontal tunnel: block vertical movement
      moveY = 0;
      player.dirY = 0;
    } else if (isVerticalTunnel && moveX !== 0) {
      // Vertical tunnel: block horizontal movement
      moveX = 0;
      player.dirX = 0;
    }
  }

  // Also check restrictions when approaching bridges/tunnels
  // BUT: Only apply bridge restrictions when on layer 2 (walking over bridge)
  // On layer 1 (tunnel layer), bridges don't restrict movement (you pass under them)
  if (targetCode === 6 && player.layer === 2) {
    const upTile = tileAt(maze, targetTile.row - 1, targetTile.col);
    const downTile = tileAt(maze, targetTile.row + 1, targetTile.col);
    const leftTile = tileAt(maze, targetTile.row, targetTile.col - 1);
    const rightTile = tileAt(maze, targetTile.row, targetTile.col + 1);
    const isVerticalBridge = (leftTile === 8 || rightTile === 8);
    const isHorizontalBridge = (upTile === 8 || downTile === 8);
    
    if (isVerticalBridge && moveX !== 0) {
      moveX = 0;
      player.dirX = 0;
    } else if (isHorizontalBridge && moveY !== 0) {
      moveY = 0;
      player.dirY = 0;
    }
  }

  if (targetCode === 8) {
    const upTile = tileAt(maze, targetTile.row - 1, targetTile.col);
    const downTile = tileAt(maze, targetTile.row + 1, targetTile.col);
    const leftTile = tileAt(maze, targetTile.row, targetTile.col - 1);
    const rightTile = tileAt(maze, targetTile.row, targetTile.col + 1);
    const isHorizontalTunnel = (leftTile === 8 || rightTile === 8);
    const isVerticalTunnel = (upTile === 8 || downTile === 8);
    
    if (isHorizontalTunnel && moveY !== 0) {
      moveY = 0;
      player.dirY = 0;
    } else if (isVerticalTunnel && moveX !== 0) {
      moveX = 0;
      player.dirX = 0;
    }
  }

  // Switch tiles: restrict exits based on mode when standing on a switch
  if (currentTileCode === 7) {
    const sw = getSwitchAt(currentTile.row, currentTile.col);
    if (sw) {
      if (sw.mode === "vertical" && moveX !== 0) {
        moveX = 0;
        player.dirX = 0;
      } else if (sw.mode === "horizontal" && moveY !== 0) {
        moveY = 0;
        player.dirY = 0;
      }
    }
  }

  // Approaching switches from outside: treat blocked sides like walls
  if (targetCode === 7) {
    const sw = getSwitchAt(targetTile.row, targetTile.col);
    if (sw) {
      if (sw.mode === "vertical" && moveX !== 0) {
        moveX = 0;
        player.dirX = 0;
      } else if (sw.mode === "horizontal" && moveY !== 0) {
        moveY = 0;
        player.dirY = 0;
      }
    }
  }
  
  // Check collisions with layer awareness (use target layer for movement checks, allow transition)
  if (!blocked(maze, player.x + moveX, player.y, player.w, player.h, player.layer, targetLayer)) player.x += moveX;
  if (!blocked(maze, player.x, player.y + moveY, player.w, player.h, player.layer, targetLayer)) player.y += moveY;

  // Stop on collision but keep desired for next intersection
  if (blocked(maze, player.x + moveX, player.y, player.w, player.h, player.layer, targetLayer)) player.dirX = 0;
  if (blocked(maze, player.x, player.y + moveY, player.w, player.h, player.layer, targetLayer)) player.dirY = 0;

  applyPortal(player, maze, portals);

  if (DEBUG_PLAYER) console.log("Player", { x: player.x.toFixed(1), y: player.y.toFixed(1), dirX: player.dirX, dirY: player.dirY, desiredX: player.desiredX, desiredY: player.desiredY });
}

// Import DEBUG_PLAYER for the log statement
import { DEBUG_PLAYER } from './config.js';

