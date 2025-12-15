(() => {
  // Unicorn Run - core implementation with debug toggles

  // Debug toggles (set true to log to console)
  const DEBUG_PLAYER = false;
  const DEBUG_UNICORN = false;

  // DOM
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const startButton = document.getElementById("startButton");
  const joystickLeft = document.getElementById("joystickLeft");
  const joystickRight = document.getElementById("joystickRight");

  // Constants
  const TILE = 32;
  const ROWS = 15;
  const COLS = 21;
  const CANVAS_W = COLS * TILE;
  const CANVAS_H = ROWS * TILE;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  const PLAYER_SPEED = 180;
  const UNICORN_SPEED = 115;
  const INVINCIBLE_SECONDS = 6;
  const GEM_RESPAWN_MS = 2500;
  const RANDOM_INTERSECTION_COUNT = 2;

  const STATE = {
    TITLE: "title",
    PLAYING_NORMAL: "playing_normal",
    PLAYING_INVINCIBLE: "playing_invincible",
    GAMEOVER: "gameover",
    WIN: "win",
  };

  // Maze: 0 floor, 1 wall, 5 portal
  const maze = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,1],
    [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
    [1,1,1,1,1,0,1,0,1,1,0,1,1,0,1,0,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // State
  let gameState = STATE.TITLE;
  let score = 0;
  let invincibleTimer = 0;
  let gemCooldown = 0;
  let randomStepsLeft = 0;
  let unicornTrail = [];
  let unicornStars = [];
  let unicornTagged = false;
  let floatTexts = [];
  let unicornRespawnPause = 0;
  let gemsCollected = 0;

  let player = {};
  let unicorn = {};
  let dots = new Set();
  let gem = { x: 0, y: 0, w: 18, h: 18 };

  const keys = new Set();
  const joystickState = {
    left: { active: false, dx: 0, dy: 0, id: null, stick: joystickLeft?.querySelector(".joystick-stick") },
    right:{ active: false, dx: 0, dy: 0, id: null, stick: joystickRight?.querySelector(".joystick-stick") },
  };

  // Helpers
  const pixelToGrid = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor(y / TILE) });
  const gridToPixel = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  const tileAt = (row, col) => (row < 0 || row >= ROWS || col < 0 || col >= COLS) ? 1 : maze[row][col];
  const isWall = (row, col) => tileAt(row, col) === 1;
  const isPortal = (row, col) => tileAt(row, col) === 5;
  const rectanglesOverlap = (a, b) =>
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2;

  function resetEntities() {
    player = { x: TILE * 1.5, y: TILE * 1.5, w: 20, h: 20, dirX: 0, dirY: 0, desiredX: 0, desiredY: 0, speed: PLAYER_SPEED };
    unicorn = { x: TILE * 19.5, y: TILE * 13.5, w: 24, h: 24, dirX: -1, dirY: 0, speed: UNICORN_SPEED };
    invincibleTimer = 0;
    randomStepsLeft = 0;
    unicornTrail = [];
    unicornStars = [];
    unicornTagged = false;
    floatTexts = [];
    unicornRespawnPause = 0;
    gemsCollected = 0;
  }

  function seedDots() {
    dots.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c] === 0) dots.add(`${r},${c}`);
      }
    }
  }

  function placeGem() {
    const floors = Array.from(dots).map((id) => id.split(",").map(Number));
    const candidates = floors.length ? floors : [];
    if (!candidates.length) return;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    const pos = gridToPixel(choice[1], choice[0]);
    gem.x = pos.x;
    gem.y = pos.y;
  }

  function updateUI() {
    scoreEl.textContent = `Score: ${score}`;
    const stateText = {
      [STATE.TITLE]: "Press Space or Start",
      [STATE.PLAYING_NORMAL]: "Collect dots + gems!",
      [STATE.PLAYING_INVINCIBLE]: "Invincible! Avoid walls.",
      [STATE.GAMEOVER]: "Game Over - press Space or Start",
      [STATE.WIN]: "You win! Press Space or Start",
    };
    statusEl.textContent = stateText[gameState];
    if (startButton) {
      startButton.textContent = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE ? "Restart" : "Start";
    }
  }

  // Input
  document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
    if (e.code === "Space" && (gameState === STATE.TITLE || gameState === STATE.GAMEOVER || gameState === STATE.WIN)) {
      startGame();
    }
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  startButton?.addEventListener("click", (e) => { e.preventDefault(); startGame(); });

  function joystickHandlers(el, side) {
    const state = joystickState[side];
    const stick = state.stick;
    const start = (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      state.id = touch.identifier;
      state.active = true;
      el.classList.add("active");
      move(touch);
    };
    const move = (touch) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = touch.clientX - cx;
      const dy = touch.clientY - cy;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2 - 18);
      const angle = Math.atan2(dy, dx);
      const sx = Math.cos(angle) * dist;
      const sy = Math.sin(angle) * dist;
      stick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
      const absX = Math.abs(Math.cos(angle));
      const absY = Math.abs(Math.sin(angle));
      if (dist < 10) { state.dx = 0; state.dy = 0; return; }
      if (absX > absY) { state.dx = Math.cos(angle) > 0 ? 1 : -1; state.dy = 0; }
      else { state.dy = Math.sin(angle) > 0 ? 1 : -1; state.dx = 0; }
    };
    const handleMove = (e) => {
      e.preventDefault();
      const touch = Array.from(e.touches).find((t) => t.identifier === state.id);
      if (touch) move(touch);
    };
    const end = (e) => {
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === state.id);
      if (!touch) return;
      state.active = false;
      state.id = null;
      state.dx = 0;
      state.dy = 0;
      stick.style.transform = "translate(-50%, -50%)";
      el.classList.remove("active");
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
  }
  if (joystickLeft) joystickHandlers(joystickLeft, "left");
  if (joystickRight) joystickHandlers(joystickRight, "right");

  // Movement + collisions
  function blocked(x, y, w, h) {
    const corners = [
      { x: x - w / 2, y: y - h / 2 },
      { x: x + w / 2, y: y - h / 2 },
      { x: x - w / 2, y: y + h / 2 },
      { x: x + w / 2, y: y + h / 2 },
    ];
    for (const p of corners) {
      const { row, col } = pixelToGrid(p.x, p.y);
      if (isWall(row, col)) return true;
    }
    return false;
  }

  function applyPortal(entity) {
    const { row, col } = pixelToGrid(entity.x, entity.y);
    if (!isPortal(row, col)) return;
    if (col <= 0) {
      const target = gridToPixel(COLS - 2, row);
      entity.x = target.x;
    } else if (col >= COLS - 1) {
      const target = gridToPixel(1, row);
      entity.x = target.x;
    }
  }

  function updatePlayer(dt) {
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
      if (!blocked(testX, testY, player.w, player.h)) {
        player.dirX = player.desiredX;
        player.dirY = player.desiredY;
      }
    }

    // If we’re stopped but have a desired direction, try to start moving
    if (player.dirX === 0 && player.dirY === 0 && (player.desiredX !== 0 || player.desiredY !== 0)) {
      const testX = player.x + player.desiredX * TILE * 0.4;
      const testY = player.y + player.desiredY * TILE * 0.4;
      if (!blocked(testX, testY, player.w, player.h)) {
        player.dirX = player.desiredX;
        player.dirY = player.desiredY;
      }
    }

    // Move using current direction (persists without holding keys)
    const moveX = player.dirX * player.speed * dt;
    const moveY = player.dirY * player.speed * dt;
    if (!blocked(player.x + moveX, player.y, player.w, player.h)) player.x += moveX;
    if (!blocked(player.x, player.y + moveY, player.w, player.h)) player.y += moveY;

    // Stop on collision but keep desired for next intersection
    if (blocked(player.x + moveX, player.y, player.w, player.h)) player.dirX = 0;
    if (blocked(player.x, player.y + moveY, player.w, player.h)) player.dirY = 0;

    applyPortal(player);

    if (DEBUG_PLAYER) console.log("Player", { x: player.x.toFixed(1), y: player.y.toFixed(1), dirX: player.dirX, dirY: player.dirY, desiredX: player.desiredX, desiredY: player.desiredY });
  }

  function chooseUnicornDir() {
    const at = pixelToGrid(unicorn.x, unicorn.y);
    const center = gridToPixel(at.col, at.row);
    // Only make decisions when centered on a tile
    if (Math.abs(unicorn.x - center.x) > 1 || Math.abs(unicorn.y - center.y) > 1) return;

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
      return !blocked(testX, testY, unicorn.w, unicorn.h);
    });

    // Determine intersection/corner status (exclude pure forward/back corridor)
    const reverseDir = { x: -unicorn.dirX, y: -unicorn.dirY };
    const validNonReverse = valid.filter(d => !(d.x === reverseDir.x && d.y === reverseDir.y));
    const isIntersection = validNonReverse.length >= 2; // 3-way or 4-way
    const isCorner = validNonReverse.length === 1 && valid.length >= 2 && !(valid[0].x === -valid[1].x && valid[0].y === -valid[1].y);

    // If we're not at an intersection/corner and not in random mode, keep current direction
    if (randomStepsLeft <= 0 && !isIntersection && !isCorner) return;

    if (randomStepsLeft > 0) {
      randomStepsLeft--;
      const pick = valid[Math.floor(Math.random() * valid.length)];
      unicorn.dirX = pick?.x ?? unicorn.dirX;
      unicorn.dirY = pick?.y ?? unicorn.dirY;
      return;
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
    const primary = chaseMode
      ? (distX > distY
          ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) }]
          : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx), y: 0 }])
      : (distX > distY
          ? [{ x: -Math.sign(dx), y: 0 }, { x: 0, y: -Math.sign(dy) }]
          : [{ x: 0, y: -Math.sign(dy) }, { x: -Math.sign(dx), y: 0 }]);

    if (chooseDir(primary)) {
      if (DEBUG_UNICORN) console.log("Unicorn choose", { dir: { x: unicorn.dirX, y: unicorn.dirY }, reason: chaseMode ? "greedy" : "avoid" });
      return;
    }

    // Fallback: any valid non-reverse, else any valid
    const pick = (validNonReverse[0] ?? valid[0]);
    if (pick) {
      unicorn.dirX = pick.x;
      unicorn.dirY = pick.y;
      if (DEBUG_UNICORN) console.log("Unicorn choose", { dir: pick, reason: "fallback" });
    }
  }

  function updateUnicorn(dt) {
    // During respawn pause, unicorn stays still and does not decide directions
    if (unicornRespawnPause > 0) {
      unicornRespawnPause -= dt;
      if (unicornRespawnPause < 0) unicornRespawnPause = 0;
      return;
    }

    const prevX = unicorn.x;
    const prevY = unicorn.y;

    chooseUnicornDir();
    const moveX = unicorn.dirX * unicorn.speed * dt;
    const moveY = unicorn.dirY * unicorn.speed * dt;

    if (!blocked(unicorn.x + moveX, unicorn.y, unicorn.w, unicorn.h)) unicorn.x += moveX;
    if (!blocked(unicorn.x, unicorn.y + moveY, unicorn.w, unicorn.h)) unicorn.y += moveY;

    if (unicorn.x === prevX && unicorn.y === prevY) {
      unicorn.dirX = -unicorn.dirX;
      unicorn.dirY = -unicorn.dirY;
      randomStepsLeft = RANDOM_INTERSECTION_COUNT;
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
        if (!blocked(testX, testY, unicorn.w, unicorn.h)) {
          unicorn.dirX = dir.x;
          unicorn.dirY = dir.y;
          break;
        }
      }
    }

    applyPortal(unicorn);

    // Always leave a rainbow tail
    unicornTrail.push({
      x: unicorn.x,
      y: unicorn.y,
      life: 0.35,
      maxLife: 0.35,
      hue: (performance.now() / 8) % 360
    });

    // During invincibility, shoot rainbow star sparks
    if (gameState === STATE.PLAYING_INVINCIBLE && invincibleTimer > 0) {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 80;
        unicornStars.push({
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
  }

  function updateTrail(dt) {
    unicornTrail = unicornTrail
      .map(p => ({ ...p, life: p.life - dt }))
      .filter(p => p.life > 0);
  }

  function updateStars(dt) {
    unicornStars = unicornStars
      .map(p => ({
        ...p,
        life: p.life - dt,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
      }))
      .filter(p => p.life > 0);
  }

  function updateFloatTexts(dt) {
    floatTexts = floatTexts
      .map(t => ({
        ...t,
        life: t.life - dt,
        y: t.y - 30 * dt
      }))
      .filter(t => t.life > 0);
  }

  // Collectibles
  function updateDots() {
    const { row, col } = pixelToGrid(player.x, player.y);
    const id = `${row},${col}`;
    if (dots.has(id)) {
      dots.delete(id);
      score += 1;
      updateUI();
      if (dots.size === 0) {
        gameState = STATE.WIN;
        updateUI();
      }
    }
  }

  function updateGem(dt) {
    // Enforce a maximum of 5 gems per run
    if (gemsCollected >= 5) return;

    if (gemCooldown > 0) {
      gemCooldown -= dt * 1000;
      if (gemCooldown <= 0) placeGem();
    }
    if (gemCooldown > 0) return;
    if (rectanglesOverlap(player, gem)) {
      invincibleTimer = INVINCIBLE_SECONDS;
      gameState = STATE.PLAYING_INVINCIBLE;
      unicornTagged = false;
      score += 5;
      gemsCollected += 1;
      gemCooldown = GEM_RESPAWN_MS;
      // Force the unicorn to reverse immediately when player gains invincibility
      unicorn.dirX = -unicorn.dirX;
      unicorn.dirY = -unicorn.dirY;
      randomStepsLeft = RANDOM_INTERSECTION_COUNT;
      updateUI();
    }
  }

  // State management
  function startGame() {
    score = 0;
    gemCooldown = 0;
    resetEntities();
    seedDots();
    placeGem();
    gameState = STATE.PLAYING_NORMAL;
    updateUI();
  }

  // Rendering
  function drawMaze() {
    ctx.fillStyle = "#f7f9ff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = maze[r][c];
        if (t === 1) {
          ctx.fillStyle = "#2c2f48";
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        } else if (t === 5) {
          ctx.fillStyle = "#d4ddff";
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }
  }

  function drawDots() {
    ctx.fillStyle = "#9bb4ff";
    for (const id of dots) {
      const [r, c] = id.split(",").map(Number);
      const pos = gridToPixel(c, r);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGem() {
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

  function drawTrail() {
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

  function drawStars() {
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

  function drawFloatTexts() {
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

  function drawPlayer() {
    ctx.fillStyle = "#36cfc9";
    ctx.strokeStyle = "#1890ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawUnicorn() {
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

  function drawOverlay(text, color) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = color;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.fillText("Press Space or Start", CANVAS_W / 2, CANVAS_H / 2 + 32);
  }

  function rainbowColor(t) {
    const hue = (t / 20) % 360;
    return `hsl(${hue}, 80%, 70%)`;
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawMaze();
    drawDots();
    drawGem();
    drawTrail();
    drawStars();
    drawFloatTexts();
    drawPlayer();
    drawUnicorn();

    if (gameState === STATE.TITLE) drawOverlay("Unicorn Run", "#ffd166");
    if (gameState === STATE.GAMEOVER) drawOverlay("Game Over", "#ff4d6d");
    if (gameState === STATE.WIN) drawOverlay("You Win!", "#36cfc9");
  }

  // Loop
  let lastTime = performance.now();
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
      updatePlayer(dt);
      updateUnicorn(dt);
      updateTrail(dt);
      updateStars(dt);
      updateFloatTexts(dt);
      updateDots();
      updateGem(dt);
      if (invincibleTimer > 0) {
        invincibleTimer -= dt;
        if (invincibleTimer <= 0) {
          gameState = STATE.PLAYING_NORMAL;
          updateUI();
        }
      }

      // No collision effects while unicorn is in respawn pause; it's effectively not there
      if (unicornRespawnPause <= 0 && rectanglesOverlap(player, unicorn)) {
        if (gameState === STATE.PLAYING_INVINCIBLE) {
          // Tag unicorn once per invincibility window
          if (!unicornTagged) {
            unicornTagged = true;
            score += 10;
            floatTexts.push({ x: unicorn.x, y: unicorn.y - 10, text: "+10", life: 0.8, maxLife: 0.8 });

            // Respawn unicorn at maze center and end invincibility
            const centerGrid = { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2) };
            const centerPos = gridToPixel(centerGrid.col, centerGrid.row);
            unicorn.x = centerPos.x;
            unicorn.y = centerPos.y;
            unicorn.dirX = 0;
            unicorn.dirY = 0;

            invincibleTimer = 0;
            unicornRespawnPause = 3; // seconds of pause before moving again
            gameState = STATE.PLAYING_NORMAL;
            updateUI();
          }
        } else {
          gameState = STATE.GAMEOVER;
          updateUI();
        }
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  // Init
  resetEntities();
  seedDots();
  placeGem();
  updateUI();
  // Auto-start first run; restart via button/space still works
  startGame();
  requestAnimationFrame(loop);
})();
