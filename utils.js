// v1.2.1 - Utility functions

import { TILE, ROWS, COLS, MOVEMENT_DEBUG, DEBUG_ROWS, DEBUG_COLS } from './config.js';

// Grid conversion helpers
export const pixelToGrid = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });
export const gridToPixel = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// Tile access (requires maze to be passed in)
export const tileAt = (maze, row, col) => {
  const mazeRows = maze.length;
  const mazeCols = maze[0]?.length || 0;
  return (row < 0 || row >= mazeRows || col < 0 || col >= mazeCols) ? 1 : maze[row][col];
};
export const isWall = (maze, row, col) => tileAt(maze, row, col) === 1;
export const isPortal = (maze, row, col) => tileAt(maze, row, col) === 5;

// v1.3: Tile metadata helper for layer-aware logic
// Layer system: floor/bridge = layer 2, tunnels = layer 1
// Tile types: 0=floor, 1=wall, 5=tunnel entrance, 6=bridge, 7=switch, 8=tunnel path
export const getTileMetadata = (maze, row, col) => {
  const tile = tileAt(maze, row, col);
  let layer = 2; // Default to layer 2 (floor level)
  const allows = [];
  
  if (tile === 8) {
    // Tunnel path tile - exists on layer 1
    layer = 1;
  } else if (tile === 5) {
    // Tunnel entrance/wrap portal - exists on both layers, allows transition
    layer = 2; // Default layer, but allows transition
    allows.push("layer_transition");
  } else if (tile === 6) {
    // Bridge - exists on layer 2 (you walk over it)
    layer = 2;
  } else if (tile === 0) {
    // Floor - exists on layer 2
    layer = 2;
  } else if (tile === 7) {
    // Switch - exists on layer 2
    layer = 2;
  }
  // Walls (1) don't exist on any layer (they block all layers)
  
  return {
    tile,
    layer,
    allows,
  };
};

// Check if a tile exists on a specific layer
export const tileExistsOnLayer = (maze, row, col, layer) => {
  if (tileAt(maze, row, col) === 1) return false; // Walls block all layers
  const metadata = getTileMetadata(maze, row, col);
  if (metadata.tile === 5) return true; // Tunnel entrances exist on both layers
  return metadata.layer === layer;
};

// Collision detection
export const rectanglesOverlap = (a, b) =>
  a.x - a.w / 2 < b.x + b.w / 2 &&
  a.x + a.w / 2 > b.x - b.w / 2 &&
  a.y - a.h / 2 < b.y + b.h / 2 &&
  a.y + a.h / 2 > b.y - b.h / 2;

// Wall collision check (requires maze to be passed in)
// v1.3: Layer-aware - only tiles that exist on the entity's layer can block
// Walls block all layers, but bridges/floor only block layer 2, tunnels only block layer 1
// v1.3: Switch blocking - switches block like walls based on their mode and movement direction
// moveDirX and moveDirY indicate the movement direction (0 = not moving in that axis, non-zero = moving)
// getSwitchAt is optional function to get switch info at a position
export const blocked = (maze, x, y, w, h, layer = 2, targetLayer = null, moveDirX = 0, moveDirY = 0, getSwitchAt = null) => {
  const corners = [
    { x: x - w / 2, y: y - h / 2 },
    { x: x + w / 2, y: y - h / 2 },
    { x: x - w / 2, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 },
  ];
  for (const p of corners) {
    const { row, col } = pixelToGrid(p.x, p.y);
    const tile = tileAt(maze, row, col);
    
    // Walls always block regardless of layer
    if (tile === 1) return true;
    
    // Switches block like walls based on their mode and movement direction
    // Vertical switch blocks horizontal movement, horizontal switch blocks vertical movement
    if (tile === 7 && getSwitchAt) {
      const sw = getSwitchAt(row, col);
      if (sw) {
        // Vertical switch blocks horizontal movement (moveDirX !== 0)
        if (sw.mode === "vertical" && moveDirX !== 0) {
          return true; // Blocked by vertical switch
        }
        // Horizontal switch blocks vertical movement (moveDirY !== 0)
        if (sw.mode === "horizontal" && moveDirY !== 0) {
          return true; // Blocked by horizontal switch
        }
      }
    }
    
    // Special case: Bridges (tile 6) don't block entities on layer 1 (tunnel layer)
    // Entities on layer 1 can pass under bridges
    if (tile === 6 && layer === 1) {
      continue; // Bridge doesn't block tunnel layer, allow passage
    }
    
    // Check if this tile exists on the entity's current layer
    // If not, it doesn't block (e.g., tunnels don't block layer 2)
    const existsOnCurrentLayer = tileExistsOnLayer(maze, row, col, layer);
    
    if (!existsOnCurrentLayer) {
      // Special case: bridges don't block layer 1, even if targetLayer is different
      if (tile === 6 && layer === 1) {
        continue; // Bridge doesn't block layer 1, allow passage
      }
      
      // During transition, also check target layer
      if (targetLayer !== null && targetLayer !== layer) {
        const existsOnTargetLayer = tileExistsOnLayer(maze, row, col, targetLayer);
        // Special case: bridges don't block layer 1 even during transition
        if (tile === 6 && targetLayer === 1) {
          continue; // Bridge doesn't block when transitioning to layer 1
        }
        if (!existsOnTargetLayer) {
          return true; // Tile doesn't exist on either layer, so it blocks
        }
      } else {
        // Not transitioning and tile doesn't exist on current layer - it doesn't block
        continue; // This corner is fine, check next one
      }
    }
    // If we get here, the tile exists on the entity's layer, so it's walkable
  }
  return false;
};

