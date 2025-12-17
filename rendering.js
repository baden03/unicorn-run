// v1.3.0 - Rendering functions

import { TILE, CANVAS_W, CANVAS_H, STATE, DEBUG_PORTALS, DEBUG_BRIDGES, DEBUG_SWITCHES } from './config.js';
import { gridToPixel, tileAt } from './utils.js';
import { UNICORN_DEFINITIONS } from './entities.js';

export function drawMaze(ctx, maze, portals, switches, getSwitchAt) {
  ctx.fillStyle = "#f7f9ff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (let r = 0; r < maze.length; r++) {
    for (let c = 0; c < maze[r].length; c++) {
      const t = maze[r][c];
      if (t === 1) {
        ctx.fillStyle = "#2c2f48";
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      } else if (t === 5) {
        ctx.fillStyle = "#d4ddff";
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      } else if (t === 6) {
        // Bridge: base tile
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = "#eef2ff";
        ctx.fillRect(x, y, TILE, TILE);

        // Draw borders only on sides that are not a free path (i.e., not floor/bridge/switch)
        ctx.strokeStyle = "#a3b0ff";
        ctx.lineWidth = 3;
        const pathLike = (tr, tc) => {
          const code = tileAt(maze, tr, tc);
          return code === 0 || code === 6 || code === 7;
        };

        ctx.beginPath();
        // Top edge
        if (!pathLike(r - 1, c)) {
          ctx.moveTo(x, y + 1.5);
          ctx.lineTo(x + TILE, y + 1.5);
        }
        // Bottom edge
        if (!pathLike(r + 1, c)) {
          ctx.moveTo(x, y + TILE - 1.5);
          ctx.lineTo(x + TILE, y + TILE - 1.5);
        }
        // Left edge
        if (!pathLike(r, c - 1)) {
          ctx.moveTo(x + 1.5, y);
          ctx.lineTo(x + 1.5, y + TILE);
        }
        // Right edge
        if (!pathLike(r, c + 1)) {
          ctx.moveTo(x + TILE - 1.5, y);
          ctx.lineTo(x + TILE - 1.5, y + TILE);
        }
        ctx.stroke();
      } else if (t === 7) {
        // Switch tile: visually similar to bridge, but walls depend on mode
        const x = c * TILE;
        const y = r * TILE;
        const sw = getSwitchAt(r, c);

        ctx.fillStyle = "#e8f7ff";
        ctx.fillRect(x, y, TILE, TILE);

        // Draw walls like a bridge, but orientation follows switch mode
        ctx.strokeStyle = "#4098ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (sw?.mode === "vertical") {
          // Walls on left/right
          ctx.moveTo(x + 1.5, y);
          ctx.lineTo(x + 1.5, y + TILE);
          ctx.moveTo(x + TILE - 1.5, y);
          ctx.lineTo(x + TILE - 1.5, y + TILE);
        } else if (sw?.mode === "horizontal") {
          // Walls on top/bottom
          ctx.moveTo(x, y + 1.5);
          ctx.lineTo(x + TILE, y + 1.5);
          ctx.moveTo(x, y + TILE - 1.5);
          ctx.lineTo(x + TILE, y + TILE - 1.5);
        }
        ctx.stroke();

        // Small center marker (for debugging orientation)
        if (DEBUG_SWITCHES) {
          ctx.save();
          ctx.translate(x + TILE / 2, y + TILE / 2);
          ctx.fillStyle = "#ff7a90";
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  // Optional debug overlays for portals / bridges
  if (DEBUG_PORTALS) {
    ctx.save();
    ctx.fillStyle = "rgba(255,0,200,0.6)";
    portals.forEach((p, idx) => {
      const aPos = gridToPixel(p.a.col, p.a.row);
      const bPos = gridToPixel(p.b.col, p.b.row);
      ctx.beginPath();
      ctx.arc(aPos.x, aPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bPos.x, bPos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "10px Arial";
      ctx.fillText(String(idx), aPos.x + 6, aPos.y - 6);
      ctx.fillText(String(idx), bPos.x + 6, bPos.y - 6);
    });
    ctx.restore();
  }

  if (DEBUG_BRIDGES) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,200,255,0.9)";
    ctx.lineWidth = 2;
    for (let r = 0; r < maze.length; r++) {
      for (let c = 0; c < maze[r].length; c++) {
        if (maze[r][c] === 6) {
          ctx.strokeRect(c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8);
        }
      }
    }
    ctx.restore();
  }
}

export function drawDots(ctx, dots) {
  ctx.fillStyle = "#9bb4ff";
  for (const id of dots) {
    const [r, c] = id.split(",").map(Number);
    const pos = gridToPixel(c, r);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGem(ctx, gem, gemCooldown) {
  if (gemCooldown > 0) return;
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.fillStyle = "#ffd166";
  ctx.strokeStyle = "#ff9f1c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -gem.h / 2);
  ctx.lineTo(gem.w / 2, 0);
  ctx.lineTo(0, gem.h / 2);
  ctx.lineTo(-gem.w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawTrail(ctx, unicornTrail) {
  for (const p of unicornTrail) {
    const alpha = Math.max(p.life / p.maxLife, 0);
    const size = 6 * alpha + 2;
    ctx.save();
    ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawStars(ctx, unicornStars) {
  for (const p of unicornStars) {
    const alpha = Math.max(p.life / p.maxLife, 0);
    const size = 5 * alpha + 2;
    ctx.save();
    ctx.fillStyle = `hsla(${p.hue}, 85%, 65%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawFloatTexts(ctx, floatTexts) {
  for (const t of floatTexts) {
    const alpha = Math.max(t.life / t.maxLife, 0);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

export function drawPlayer(ctx, player) {
  ctx.fillStyle = "#36cfc9";
  ctx.strokeStyle = "#1890ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawUnicorn(ctx, unicorn, gameState, unicornRespawnPause, invincibleTimer) {
  ctx.save();
  ctx.translate(unicorn.x, unicorn.y);
  // Blink when player is invincible (unless unicorn is paused)
  const blinkOn = Math.floor(performance.now() / 150) % 2 === 0;
  const bodyColor = (gameState === STATE.PLAYING_INVINCIBLE && blinkOn && unicornRespawnPause <= 0)
    ? rainbowColor(performance.now())
    : "#ff7eb6";
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = "#e0487a";
  ctx.lineWidth = 2;
  const w = unicorn.w, h = unicorn.h;
  const radius = 5;
  ctx.beginPath();
  ctx.moveTo(-w/2 + radius, -h/2);
  ctx.lineTo(w/2 - radius, -h/2);
  ctx.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + radius);
  ctx.lineTo(w/2, h/2 - radius);
  ctx.quadraticCurveTo(w/2, h/2, w/2 - radius, h/2);
  ctx.lineTo(-w/2 + radius, h/2);
  ctx.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - radius);
  ctx.lineTo(-w/2, -h/2 + radius);
  ctx.quadraticCurveTo(-w/2, -h/2, -w/2 + radius, -h/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(0, -h/2 - 4);
  ctx.lineTo(-4, -h/2 + 6);
  ctx.lineTo(4, -h/2 + 6);
  ctx.closePath();
  ctx.fill();
  
  // Countdown text: invincibility or respawn pause (inside body)
  const flashOn = Math.floor(performance.now() / 200) % 2 === 0;
  if (flashOn && (unicornRespawnPause > 0 || (gameState === STATE.PLAYING_INVINCIBLE && invincibleTimer > 0))) {
    const value = unicornRespawnPause > 0 ? Math.ceil(unicornRespawnPause) : Math.ceil(invincibleTimer);
    ctx.fillStyle = "#000";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(value.toString(), 0, 4); // roughly center of body
  }

  ctx.restore();
}

export function drawOverlay(ctx, text, color, gameState) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = color;
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.fillStyle = "#fff";
  ctx.font = "24px Arial";
  const instructionText = gameState === STATE.PAUSED ? "Press Space or Resume" : "Press Space or Start";
  ctx.fillText(instructionText, CANVAS_W / 2, CANVAS_H / 2 + 32);
}

export function rainbowColor(t) {
  const hue = (t / 20) % 360;
  return `hsl(${hue}, 80%, 70%)`;
}

export function draw(ctx, maze, portals, switches, dots, gem, gemCooldown, unicornTrail, unicornStars, floatTexts, player, unicorn, gameState, levelIntroTimer, levelIntroText, unicornRespawnPause, invincibleTimer, getSwitchAt) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawMaze(ctx, maze, portals, switches, getSwitchAt);
  drawDots(ctx, dots);
  drawGem(ctx, gem, gemCooldown);
  drawTrail(ctx, unicornTrail);
  drawStars(ctx, unicornStars);
  drawFloatTexts(ctx, floatTexts);
  drawPlayer(ctx, player);
  drawUnicorn(ctx, unicorn, gameState, unicornRespawnPause, invincibleTimer);

  if (levelIntroTimer > 0) {
    drawOverlay(ctx, levelIntroText, "#7c89ff", gameState);
  } else {
    if (gameState === STATE.TITLE) drawOverlay(ctx, "Unicorn Run", "#ffd166", gameState);
    if (gameState === STATE.GAMEOVER) drawOverlay(ctx, "Game Over", "#ff4d6d", gameState);
    if (gameState === STATE.WIN) drawOverlay(ctx, "You Win!", "#36cfc9", gameState);
    if (gameState === STATE.PAUSED) drawOverlay(ctx, "Paused", "#ffd166", gameState);
  }
}

