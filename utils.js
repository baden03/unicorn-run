// v1.2.1 - Utility functions

import { TILE, ROWS, COLS } from './config.js';

// Grid conversion helpers
export const pixelToGrid = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });
export const gridToPixel = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// Tile access (requires maze to be passed in)
export const tileAt = (maze, row, col) => (row < 0 || row >= ROWS || col < 0 || col >= COLS) ? 1 : maze[row][col];
export const isWall = (maze, row, col) => tileAt(maze, row, col) === 1;
export const isPortal = (maze, row, col) => tileAt(maze, row, col) === 5;

// Collision detection
export const rectanglesOverlap = (a, b) =>
  a.x - a.w / 2 < b.x + b.w / 2 &&
  a.x + a.w / 2 > b.x - b.w / 2 &&
  a.y - a.h / 2 < b.y + b.h / 2 &&
  a.y + a.h / 2 > b.y - b.h / 2;

// Wall collision check (requires maze to be passed in)
export const blocked = (maze, x, y, w, h) => {
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

