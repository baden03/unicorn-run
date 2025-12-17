// v1.2.1 - Utility functions

import { TILE, ROWS, COLS } from './config.js';

// Grid conversion helpers
export const pixelToGrid = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });
export const gridToPixel = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// Tile access (requires maze to be passed in)
export const tileAt = (maze, row, col) =>
  (row < 0 || row >= ROWS || col < 0 || col >= COLS) ? 1 : maze[row][col];
export const isWall = (maze, row, col) => tileAt(maze, row, col) === 1;
export const isPortal = (maze, row, col) => tileAt(maze, row, col) === 5;

// v1.3: Tile metadata helper for future layer-aware logic
// For now all non-wall tiles live on layer 0. Bridge/tunnel metadata
// is introduced in later steps of the v1.3 plan.
export const getTileMetadata = (maze, row, col) => {
  const tile = tileAt(maze, row, col);
  return {
    tile,
    layer: 0,
    allows: [], // e.g. ["up", "down"] for tunnel transitions in later steps
  };
};

// Collision detection
export const rectanglesOverlap = (a, b) =>
  a.x - a.w / 2 < b.x + b.w / 2 &&
  a.x + a.w / 2 > b.x - b.w / 2 &&
  a.y - a.h / 2 < b.y + b.h / 2 &&
  a.y + a.h / 2 > b.y - b.h / 2;

// Wall collision check (requires maze to be passed in)
// v1.3: Signature accepts an optional `layer` argument. Layer-aware
// rules are introduced in later tunnel/bridge tasks; for now this
// behaves exactly like the v1.2 implementation.
export const blocked = (maze, x, y, w, h, layer = 0) => {
  const corners = [
    { x: x - w / 2, y: y - h / 2 },
    { x: x + w / 2, y: y - h / 2 },
    { x: x - w / 2, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 },
  ];
  for (const p of corners) {
    const { row, col } = pixelToGrid(p.x, p.y);
    if (isWall(maze, row, col)) return true;
  }
  return false;
};

