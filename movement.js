// v1.2.1 - Movement logic

import { TILE, COLS, DEBUG_PORTALS } from './config.js';
import { pixelToGrid, gridToPixel, blocked, tileAt, isPortal } from './utils.js';

export function applyPortal(entity, maze, portals) {
  const { row, col } = pixelToGrid(entity.x, entity.y);
  if (!isPortal(maze, row, col)) return;

  // Edge portals (side wrap) keep their classic behavior:
  // move to the opposite side corridor, not onto another portal tile.
  if (col === 0 || col === COLS - 1) {
    const targetCol = col === 0 ? COLS - 2 : 1;
    const pos = gridToPixel(targetCol, row);
    entity.x = pos.x;
    entity.y = pos.y;
    if (DEBUG_PORTALS) {
      console.log("Side portal wrap", { from: { row, col }, to: { row, col: targetCol } });
    }
    return;
  }

  // Internal portals (e.g. bridge tunnels) use the maze-factory portal pairs
  const pair = portals.find(
    (p) =>
      (p.a.row === row && p.a.col === col) ||
      (p.b.row === row && p.b.col === col)
  );
  if (!pair) return;

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
    if (DEBUG_PORTALS) {
      console.log("Bridge portal -> far side tile", {
        from: { row, col },
        bridge: { row: bridgeRow, col: bridgeCol },
        to: { row: bridgeRow, col: targetCol },
      });
    }
    return;
  }

  // Generic paired portals: teleport to the other portal tile
  const target = (pair.a.row === row && pair.a.col === col) ? pair.b : pair.a;
  const pos = gridToPixel(target.col, target.row);
  entity.x = pos.x;
  entity.y = pos.y;
  if (DEBUG_PORTALS) {
    console.log("Paired portal", { from: { row, col }, to: target });
  }
}

export function updatePlayer(dt, player, maze, switches, portals, keys, joystickState, getSwitchAt) {
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

  // If near center and desired differs, try to turn
  const nearCenter = Math.abs(player.x - center.x) < turnSnap && Math.abs(player.y - center.y) < turnSnap;
  const wantsTurn = (player.desiredX !== player.dirX || player.desiredY !== player.dirY);
  if (nearCenter && (player.desiredX !== 0 || player.desiredY !== 0) && wantsTurn) {
    const testX = center.x + player.desiredX * TILE * 0.4;
    const testY = center.y + player.desiredY * TILE * 0.4;
    if (!blocked(maze, testX, testY, player.w, player.h)) {
      player.dirX = player.desiredX;
      player.dirY = player.desiredY;
    }
  }

  // If we're stopped but have a desired direction, try to start moving
  if (player.dirX === 0 && player.dirY === 0 && (player.desiredX !== 0 || player.desiredY !== 0)) {
    const testX = player.x + player.desiredX * TILE * 0.4;
    const testY = player.y + player.desiredY * TILE * 0.4;
    if (!blocked(maze, testX, testY, player.w, player.h)) {
      player.dirX = player.desiredX;
      player.dirY = player.desiredY;
    }
  }

  // Move using current direction (persists without holding keys)
  let moveX = player.dirX * player.speed * dt;
  let moveY = player.dirY * player.speed * dt;

  // Tile-based special rules
  const currentTile = pixelToGrid(player.x, player.y);
  const currentTileCode = tileAt(maze, currentTile.row, currentTile.col);

  // Bridges: act like a straight cross-over piece.
  // For v1.2, allow only vertical movement while on a bridge tile.
  if (currentTileCode === 6 && moveX !== 0) {
    moveX = 0;
    player.dirX = 0;
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
  const targetTile = pixelToGrid(player.x + moveX, player.y + moveY);
  const targetCode = tileAt(maze, targetTile.row, targetTile.col);
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
  if (!blocked(maze, player.x + moveX, player.y, player.w, player.h)) player.x += moveX;
  if (!blocked(maze, player.x, player.y + moveY, player.w, player.h)) player.y += moveY;

  // Stop on collision but keep desired for next intersection
  if (blocked(maze, player.x + moveX, player.y, player.w, player.h)) player.dirX = 0;
  if (blocked(maze, player.x, player.y + moveY, player.w, player.h)) player.dirY = 0;

  applyPortal(player, maze, portals);

  if (DEBUG_PLAYER) console.log("Player", { x: player.x.toFixed(1), y: player.y.toFixed(1), dirX: player.dirX, dirY: player.dirY, desiredX: player.desiredX, desiredY: player.desiredY });
}

// Import DEBUG_PLAYER for the log statement
import { DEBUG_PLAYER } from './config.js';

