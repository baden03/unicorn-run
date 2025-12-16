// v1.2.1
(() => {
  // Unicorn Run - core implementation with debug toggles

  // Debug toggles (set true to log to console / draw helpers)
  const DEBUG_PLAYER = false;
  const DEBUG_UNICORN = false;
  const DEBUG_PORTALS = false;
  const DEBUG_BRIDGES = false;
  const DEBUG_SWITCHES = false;
  // When set to a number (0-based), start directly on that level for testing
  const DEBUG_START_LEVEL = null; // e.g. 2 to start on level 3, null for default

  // DOM
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const statusEl = document.getElementById("status");
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
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
    PAUSED: "paused",
    GAMEOVER: "gameover",
    WIN: "win",
  };

  // Maze templates: 0 floor, 1 wall, 5 portal; 6 bridge, 7 switch (v1.2)
  const MAZE_CLASSIC = [
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

  // Variant 1: fully custom layout with wider outer loop and zig-zag center
  const MAZE_CLASSIC_ALT_1 = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
    [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
    [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
    [1,1,1,0,1,0,1,0,1,1,0,1,1,0,1,0,1,0,1,1,1],
    [1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // Variant 2: fully custom layout with boxy rooms and tighter corridors
  const MAZE_CLASSIC_ALT_2 = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,1],
    [1,0,1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,0,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
    [5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5],
    [1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,0,1,1],
    [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,1],
    [1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // Bridges level: derive from classic and add several 4-way bridges with side portals
  const MAZE_BRIDGES = (() => {
    const base = MAZE_CLASSIC.map((row) => row.slice());

    // Find 4-way intersections: floor with floor in all four directions
    const fourWays = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (base[r][c] !== 0) continue;
        const up = base[r - 1][c];
        const down = base[r + 1][c];
        const left = base[r][c - 1];
        const right = base[r][c + 1];
        if (up === 0 && down === 0 && left === 0 && right === 0) {
          fourWays.push({ row: r, col: c });
        }
      }
    }

    // Use up to three 4-way intersections for bridges
    for (let i = 0; i < fourWays.length && i < 3; i++) {
      const { row, col } = fourWays[i];
      // Bridge tile itself
      base[row][col] = 6;
      // Block the horizontal surface path with portals that tunnel under the bridge
      base[row][col - 1] = 5;
      base[row][col + 1] = 5;
      // Vertical neighbors remain floor (straight crossing over the bridge)
    }

    return base;
  })();

  // Switches level: derive from classic and place switches only at 4-way intersections (tile 7)
  const MAZE_SWITCHES = (() => {
    const base = MAZE_CLASSIC.map((row) => row.slice());

    const fourWays = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (base[r][c] !== 0) continue;
        const up = base[r - 1][c];
        const down = base[r + 1][c];
        const left = base[r][c - 1];
        const right = base[r][c + 1];
        if (up === 0 && down === 0 && left === 0 && right === 0) {
          fourWays.push({ row: r, col: c });
        }
      }
    }

    // Choose up to three 4-way intersections to host switches
    for (let i = 0; i < fourWays.length && i < 3; i++) {
      const { row, col } = fourWays[i];
      base[row][col] = 7;
    }

    return base;
  })();

  // Combined level: start from bridges layout and add switches at remaining 4-way intersections
  const MAZE_BRIDGES_SWITCHES = (() => {
    const base = MAZE_BRIDGES.map((row) => row.slice());
    const fourWays = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (base[r][c] !== 0) continue;
        const up = base[r - 1][c];
        const down = base[r + 1][c];
        const left = base[r][c - 1];
        const right = base[r][c + 1];
        if (up === 0 && down === 0 && left === 0 && right === 0) {
          fourWays.push({ row: r, col: c });
        }
      }
    }
    for (let i = 0; i < fourWays.length && i < 2; i++) {
      const { row, col } = fourWays[i];
      base[row][col] = 7;
    }
    return base;
  })();

  const levels = [
    { id: 1, name: "Classic",          type: "classic",          rows: ROWS, cols: COLS, portals: true },
    { id: 2, name: "Bridges",          type: "bridges",          rows: ROWS, cols: COLS, portals: true },
    { id: 3, name: "Switches",         type: "switches",         rows: ROWS, cols: COLS, portals: true },
    { id: 4, name: "Bridges+Switches", type: "bridges_switches", rows: ROWS, cols: COLS, portals: true },
  ];

  let currentLevelIndex = 0;

  // Active maze + per-level metadata
  let maze = MAZE_CLASSIC.map((row) => row.slice());
  let portals = [];
  let switches = [];

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

  // Level intro overlay
  let levelIntroTimer = 0;
  let levelIntroText = "";

  // Track player tile for switch entry detection
  let lastPlayerTileRow = null;
  let lastPlayerTileCol = null;

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

  // --- Maze factory (v1.2) ---

  function pickTemplateForLevel(level) {
    switch (level.type) {
      case "bridges":
        return MAZE_BRIDGES;
      case "switches":
        return MAZE_SWITCHES;
      case "bridges_switches":
        return MAZE_BRIDGES_SWITCHES;
      case "classic":
      default: {
        // Level 1 always uses the base classic maze, others can be random
        if (level.id === 1) {
          return MAZE_CLASSIC;
        }
        // Randomly pick one of the three classic layouts for other classic levels
        const classicVariants = [MAZE_CLASSIC, MAZE_CLASSIC_ALT_1, MAZE_CLASSIC_ALT_2];
        const idx = Math.floor(Math.random() * classicVariants.length);
        return classicVariants[idx];
      }
    }
  }

  function buildPortalsFromMaze(sourceMaze) {
    const used = new Set();
    const pairs = [];

    const key = (r, c) => `${r},${c}`;

    // 1) Classic side portals: pair left/right edges on the same row.
    for (let r = 0; r < ROWS; r++) {
      if (sourceMaze[r][0] === 5 && sourceMaze[r][COLS - 1] === 5) {
        pairs.push({
          a: { row: r, col: 0 },
          b: { row: r, col: COLS - 1 },
        });
        used.add(key(r, 0));
        used.add(key(r, COLS - 1));
      }
    }

    // 2) Bridge tunnels: for each row, look for 5,6,5 patterns and pair the 5s.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 1; c < COLS - 2; c++) {
        if (sourceMaze[r][c] === 5 &&
            sourceMaze[r][c + 1] === 6 &&
            sourceMaze[r][c + 2] === 5 &&
            !used.has(key(r, c)) &&
            !used.has(key(r, c + 2))) {
          pairs.push({
            a: { row: r, col: c },
            b: { row: r, col: c + 2 },
          });
          used.add(key(r, c));
          used.add(key(r, c + 2));
          c += 2; // skip over this bridge pair
        }
      }
    }

    return pairs;
  }

  function buildSwitchesFromMaze(sourceMaze) {
    const result = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (sourceMaze[r][c] === 7) {
          // Alternate initial mode for a bit of variety
          const mode = (result.length % 2 === 0) ? "vertical" : "horizontal";
          result.push({ row: r, col: c, mode, pending: false, timer: 0 });
        }
      }
    }
    return result;
  }

  function createMazeForLevel(levelConfig) {
    const template = pickTemplateForLevel(levelConfig);
    const newMaze = template.map((row) => row.slice());
    const newPortals = buildPortalsFromMaze(newMaze);
    const newSwitches = buildSwitchesFromMaze(newMaze);

    // Spawn positions expressed in grid coordinates
    const spawns = {
      player: { row: 1, col: 1 },
      unicorn: { row: 13, col: 19 },
    };

    return { maze: newMaze, portals: newPortals, switches: newSwitches, spawns };
  }

  function seedDotsFromMaze(sourceMaze, levelConfig, spawns) {
    dots.clear();
    const playerSpawn = spawns?.player;
    const unicornSpawn = spawns?.unicorn;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = sourceMaze[r][c];
        // Basic rule: dots on floor/bridge/switch, but not on portals
        const walkableForDots = tile === 0 || tile === 6 || tile === 7;
        if (!walkableForDots) continue;
        // Avoid spawning on player/unicorn start tiles
        if (playerSpawn && playerSpawn.row === r && playerSpawn.col === c) continue;
        if (unicornSpawn && unicornSpawn.row === r && unicornSpawn.col === c) continue;
        dots.add(`${r},${c}`);
      }
    }
  }

  function getSwitchAt(row, col) {
    return switches.find((s) => s.row === row && s.col === col) || null;
  }

  function showLevelIntro() {
    const level = levels[currentLevelIndex];
    levelIntroText = `Level ${currentLevelIndex + 1}: ${level.name}`;
    levelIntroTimer = 1.5;
  }

  function loadLevel(index, options = {}) {
    const { resetScore = false, showIntro = true } = options;
    currentLevelIndex = index;
    const level = levels[currentLevelIndex];
    const { maze: newMaze, portals: newPortals, switches: newSwitches, spawns } =
      createMazeForLevel(level);
    maze = newMaze;
    portals = newPortals;
    switches = newSwitches;
    resetEntities(spawns);
    seedDotsFromMaze(maze, level, spawns);
    gemCooldown = 0;
    placeGem();
    if (resetScore) score = 0;
    if (showIntro) showLevelIntro();
    gameState = STATE.PLAYING_NORMAL;
    updateUI();
  }

  function resetEntities(spawns) {
    const playerSpawn = spawns?.player || { row: 1, col: 1 };
    const unicornSpawn = spawns?.unicorn || { row: 13, col: 19 };
    const playerPos = gridToPixel(playerSpawn.col, playerSpawn.row);
    const unicornPos = gridToPixel(unicornSpawn.col, unicornSpawn.row);

    player = {
      x: playerPos.x,
      y: playerPos.y,
      w: 20,
      h: 20,
      dirX: 0,
      dirY: 0,
      desiredX: 0,
      desiredY: 0,
      speed: PLAYER_SPEED,
    };
    unicorn = {
      x: unicornPos.x,
      y: unicornPos.y,
      w: 24,
      h: 24,
      dirX: -1,
      dirY: 0,
      speed: UNICORN_SPEED,
    };
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
    // Backwards-compatible wrapper: use current maze and default spawns
    const spawns = { player: { row: 1, col: 1 }, unicorn: { row: 13, col: 19 } };
    seedDotsFromMaze(maze, levels[currentLevelIndex], spawns);
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
      [STATE.PAUSED]: "Paused - Press Space or Resume",
      [STATE.GAMEOVER]: "Game Over - press Space or Start",
      [STATE.WIN]: "You win! Press Space or Start",
    };
    statusEl.textContent = stateText[gameState];
    if (levelEl) {
      levelEl.textContent = `Level: ${currentLevelIndex + 1} / ${levels.length}`;
    }
    if (startButton) {
      startButton.textContent = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE ? "Restart" : "Start";
    }
    if (pauseButton) {
      pauseButton.style.display = (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE || gameState === STATE.PAUSED) ? "block" : "none";
      pauseButton.textContent = gameState === STATE.PAUSED ? "Resume" : "Pause";
    }
  }

  // Input
  document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
    if (e.code === "Space") {
      if (gameState === STATE.TITLE || gameState === STATE.GAMEOVER || gameState === STATE.WIN) {
        startGame();
      } else if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
        gameState = STATE.PAUSED;
        updateUI();
      } else if (gameState === STATE.PAUSED) {
        // Resume to the previous playing state
        gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
        updateUI();
      }
    }
  });
  document.addEventListener("keyup", (e) => keys.delete(e.code));
  startButton?.addEventListener("click", (e) => { e.preventDefault(); startGame(); });
  pauseButton?.addEventListener("click", (e) => {
    e.preventDefault();
    if (gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE) {
      gameState = STATE.PAUSED;
      updateUI();
    } else if (gameState === STATE.PAUSED) {
      gameState = invincibleTimer > 0 ? STATE.PLAYING_INVINCIBLE : STATE.PLAYING_NORMAL;
      updateUI();
    }
  });

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
    let moveX = player.dirX * player.speed * dt;
    let moveY = player.dirY * player.speed * dt;

    // Tile-based special rules
    const currentTile = pixelToGrid(player.x, player.y);
    const currentTileCode = tileAt(currentTile.row, currentTile.col);

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
    const targetCode = tileAt(targetTile.row, targetTile.col);
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
    if (!blocked(player.x + moveX, player.y, player.w, player.h)) player.x += moveX;
    if (!blocked(player.x, player.y + moveY, player.w, player.h)) player.y += moveY;

    // Stop on collision but keep desired for next intersection
    if (blocked(player.x + moveX, player.y, player.w, player.h)) player.dirX = 0;
    if (blocked(player.x, player.y + moveY, player.w, player.h)) player.dirY = 0;

    // Switch entry detection: when entering a new switch tile,
    // arm a delayed toggle rather than switching immediately.
    if (
      currentTile.row !== lastPlayerTileRow ||
      currentTile.col !== lastPlayerTileCol
    ) {
      const newCode = currentTileCode;
      if (newCode === 7) {
        const sw = getSwitchAt(currentTile.row, currentTile.col);
        if (sw) {
          if (!sw.pending) {
            sw.pending = true;
            sw.timer = 2; // seconds
            if (DEBUG_SWITCHES) {
              console.log("Switch armed", {
                row: currentTile.row,
                col: currentTile.col,
                currentMode: sw.mode,
                delay: sw.timer,
              });
            }
          }
          if (DEBUG_SWITCHES) {
            console.log("Switch crossed", {
              row: currentTile.row,
              col: currentTile.col,
            });
          }
        }
      }
      lastPlayerTileRow = currentTile.row;
      lastPlayerTileCol = currentTile.col;
    }

    applyPortal(player);

    if (DEBUG_PLAYER) console.log("Player", { x: player.x.toFixed(1), y: player.y.toFixed(1), dirX: player.dirX, dirY: player.dirY, desiredX: player.desiredX, desiredY: player.desiredY });
  }

  // Helper function to immediately choose a direction that moves away from player
  function chooseAvoidDirection() {
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
      return !blocked(testX, testY, unicorn.w, unicorn.h);
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

    // Early look-ahead for special tiles (bridges/switches):
    // If the unicorn is heading directly into a blocked side of one of these,
    // reverse and enter random mode *before* it actually reaches the tile.
    if (unicorn.dirX !== 0 || unicorn.dirY !== 0) {
      const lookAheadDist = unicorn.w * 0.5; // about half a unicorn width
      const aheadX = unicorn.x + unicorn.dirX * lookAheadDist;
      const aheadY = unicorn.y + unicorn.dirY * lookAheadDist;
      const aheadTile = pixelToGrid(aheadX, aheadY);
      const aheadCode = tileAt(aheadTile.row, aheadTile.col);

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
          randomStepsLeft = RANDOM_INTERSECTION_COUNT;
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

    let moveX = unicorn.dirX * unicorn.speed * dt;
    let moveY = unicorn.dirY * unicorn.speed * dt;

    // Bridges & switches: unicorn must respect the same directional blocks as the player
    const currentTile = pixelToGrid(unicorn.x, unicorn.y);
    const currentCode = tileAt(currentTile.row, currentTile.col);
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
    const targetCode = tileAt(targetTile.row, targetTile.col);
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
      randomStepsLeft = RANDOM_INTERSECTION_COUNT;
      if (DEBUG_UNICORN) {
        console.log("Unicorn blocked by special tile -> reverse & random", {
          tile: currentTile,
        });
      }
      return;
    }

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

  function updateSwitches(dt) {
    for (const sw of switches) {
      if (!sw.pending) continue;
      sw.timer -= dt;
      if (sw.timer <= 0) {
        sw.pending = false;
        sw.mode = sw.mode === "vertical" ? "horizontal" : "vertical";
        if (DEBUG_SWITCHES) {
          console.log("Switch toggled (timer)", {
            row: sw.row,
            col: sw.col,
            mode: sw.mode,
          });
        }
      }
    }
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
        // Level complete: advance to next or win
        if (currentLevelIndex < levels.length - 1) {
          loadLevel(currentLevelIndex + 1, { resetScore: false, showIntro: true });
        } else {
          gameState = STATE.WIN;
          updateUI();
        }
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
      // Immediately choose a direction that moves the unicorn away from the player
      chooseAvoidDirection();
      updateUI();
    }
  }

  // State management
  function startGame() {
    const hasDebugLevel = typeof DEBUG_START_LEVEL === "number";
    const clamped = hasDebugLevel
      ? Math.max(0, Math.min(levels.length - 1, DEBUG_START_LEVEL))
      : 0;
    loadLevel(clamped, { resetScore: true, showIntro: true });
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
            const code = tileAt(tr, tc);
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
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (maze[r][c] === 6) {
            ctx.strokeRect(c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8);
          }
        }
      }
      ctx.restore();
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
    const instructionText = gameState === STATE.PAUSED ? "Press Space or Resume" : "Press Space or Start";
    ctx.fillText(instructionText, CANVAS_W / 2, CANVAS_H / 2 + 32);
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

    if (levelIntroTimer > 0) {
      drawOverlay(levelIntroText, "#7c89ff");
    } else {
      if (gameState === STATE.TITLE) drawOverlay("Unicorn Run", "#ffd166");
      if (gameState === STATE.GAMEOVER) drawOverlay("Game Over", "#ff4d6d");
      if (gameState === STATE.WIN) drawOverlay("You Win!", "#36cfc9");
      if (gameState === STATE.PAUSED) drawOverlay("Paused", "#ffd166");
    }
  }

  // Loop
  let lastTime = performance.now();
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (levelIntroTimer > 0) {
      levelIntroTimer -= dt;
      if (levelIntroTimer < 0) levelIntroTimer = 0;
    }

    const playing = gameState === STATE.PLAYING_NORMAL || gameState === STATE.PLAYING_INVINCIBLE;

    if (playing && levelIntroTimer <= 0 && gameState !== STATE.PAUSED) {
      updatePlayer(dt);
      updateUnicorn(dt);
      updateTrail(dt);
      updateStars(dt);
      updateFloatTexts(dt);
      updateSwitches(dt);
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
