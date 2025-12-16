## Unicorn Run v1.2 – Developer Notes

This file captures lower-level implementation details for the v1.2 maze factory, level system, and new tile behaviors. It is referenced by `README.md` and is intended for developers extending the game.

---

## 1. Tile Codes & Constants

In `game.js`:

- `TILE = 32` (pixels)
- Grid dimensions (all levels in v1.2 share these for now):
  - `ROWS = 15`
  - `COLS = 21`

Tile codes in `maze[row][col]`:

- `0` – floor (walkable)
- `1` – wall (blocked)
- `5` – portal / tunnel (walkable + wrap/teleport behavior)
- `6` – bridge floor (walkable, visually elevated)
- `7` – switch tile (walkable, exit directions constrained)

Walkability:

- Walkable for movement: `{ 0, 5, 6, 7 }`
- Blocked: `{ 1 }` (checked via `isWall(row, col)` which uses `tileAt`).

---

## 2. Level & Maze Factory Structures

### 2.1 Levels

Defined near the top of `game.js`:

- `const levels = [ { id, name, type, rows, cols, portals }, ... ]`
- v1.2 ships with three levels:
  - `type: "classic"` – baseline maze.
  - `type: "bridges"` – same layout but with bridge tiles (`6`) across key corridors.
  - `type: "switches"` – same layout but with switch tiles (`7`) at select intersections.
- `let currentLevelIndex = 0;`

### 2.2 Maze Templates

Templates are hard-coded in `game.js`:

- `MAZE_CLASSIC` – the original v1.1 maze.
- `MAZE_BRIDGES` – derived from `MAZE_CLASSIC` by mapping certain long corridors to `6`.
- `MAZE_SWITCHES` – derived from `MAZE_CLASSIC` by turning selected floor tiles into `7`.

These are used only by the maze factory and are cloned per level.

### 2.3 Factory API

Key functions in `game.js`:

- `pickTemplateForLevel(levelConfig)`  
  Returns one of `MAZE_CLASSIC`, `MAZE_BRIDGES`, or `MAZE_SWITCHES` based on `levelConfig.type`.

- `buildPortalsFromMaze(sourceMaze)`  
  Scans for tiles equal to `5` and pairs them sequentially:
  - Returns: `[{ a: { row, col }, b: { row, col } }, ...]`
  - Currently used as metadata (existing wrap-around still uses side columns); can be expanded later.

- `buildSwitchesFromMaze(sourceMaze)`  
  Scans for tiles equal to `7` and builds:
  - `[{ row, col, mode }]` where `mode` alternates `"vertical"` / `"horizontal"` for variety.

- `createMazeForLevel(levelConfig)`  
  - Clones the selected template.
  - Builds `portals` and `switches`.
  - Defines `spawns`:
    - `player: { row: 1, col: 1 }`
    - `unicorn: { row: 13, col: 19 }`
  - Returns: `{ maze, portals, switches, spawns }`

- `seedDotsFromMaze(sourceMaze, levelConfig, spawns)`  
  - Clears and fills `dots` set with `"row,col"` strings.
  - Places dots on tiles `{0, 6, 7}` (floor, bridges, switches), skipping:
    - Player spawn tile.
    - Unicorn spawn tile.
  - Currently **skips tile `5`** (portals) to avoid confusing “teleport dot” visuals.

Helper:

- `getSwitchAt(row, col)`  
  Returns switch object from global `switches` array or `null` if none.

- `showLevelIntro()`  
  Sets `levelIntroText` to `"Level X: Name"` and `levelIntroTimer` to 1.5 seconds.

- `loadLevel(index, options)`  
  - Options: `{ resetScore = false, showIntro = true }`.
  - Sets `currentLevelIndex`, calls `createMazeForLevel`, assigns `maze`, `portals`, `switches`.
  - Calls `resetEntities(spawns)` and `seedDotsFromMaze`.
  - Resets `gemCooldown`, calls `placeGem()`.
  - Optionally resets score and shows intro.
  - Sets `gameState` to playing and calls `updateUI()`.

---

## 3. Entity & Movement Details

### 3.1 Entities

- `player`: `{ x, y, w, h, dirX, dirY, desiredX, desiredY, speed }`
- `unicorn`: `{ x, y, w, h, dirX, dirY, speed }`

Entity reset:

- `resetEntities(spawns)`:
  - Uses `gridToPixel` on `spawns.player` and `spawns.unicorn`.
  - Resets movement vectors, invincibility-related state, unicorn trail and stars, etc.

### 3.2 Movement & Collisions

Core helpers:

- `pixelToGrid(x, y)` / `gridToPixel(col, row)`
- `tileAt(row, col)`
- `isWall(row, col)` – true iff tile is `1`.
- `blocked(x, y, w, h)` – checks the four rectangle corners against walls via `isWall`.

Player movement (`updatePlayer`):

- Input (keys / joystick) sets `desiredX` / `desiredY`.
- Turning and starting movement rely on proximity to grid centers and `blocked`.
- Movement uses:
  - `moveX = player.dirX * player.speed * dt`
  - `moveY = player.dirY * player.speed * dt`

Unicorn movement (`updateUnicorn`):

- Uses `chooseUnicornDir()` for simple greedy/random chase logic.
- Moves similarly with `moveX`/`moveY` and `blocked`.
- Respects portals through `applyPortal(unicorn)`.

---

## 4. Switch Tile Mechanics

Switch tiles use:

- Global array:  
  `let switches = [{ row, col, mode }]`
- `mode` is either `"vertical"` or `"horizontal"`.

### 4.1 Exit Constraints

While an entity is **on** a switch tile (`tileAt(row, col) === 7`), movement is constrained:

- If `mode === "vertical"`:
  - Exits `up/down` allowed.
  - Exits `left/right` blocked.
- If `mode === "horizontal"`:
  - Exits `left/right` allowed.
  - Exits `up/down` blocked.

Implementation (high level):

- In `updatePlayer`:
  - Compute `moveX` / `moveY` as usual.
  - Get current grid tile; if it’s a switch, fetch `sw = getSwitchAt(row, col)`.
  - If `sw.mode === "vertical"` and `moveX !== 0` → zero `moveX` and `player.dirX`.
  - If `sw.mode === "horizontal"` and `moveY !== 0` → zero `moveY` and `player.dirY`.

- In `updateUnicorn`:
  - Similar logic, zeroing forbidden axis and its direction component.

### 4.2 Toggle Rule

- Track last tile where the player stood:
  - `lastPlayerTileRow`, `lastPlayerTileCol`.
- On each `updatePlayer`:
  - Compute `currentTile = pixelToGrid(player.x, player.y)`.
  - If tile changed and new tile code is `7`:
    - Fetch `sw = getSwitchAt(row, col)` and toggle:
      - `sw.mode = (sw.mode === "vertical" ? "horizontal" : "vertical")`.
  - Update `lastPlayerTileRow/Col`.

Notes:

- **Only the player toggles switches**.
- The unicorn **respects** switch exit constraints but does not toggle them.
- Toggle occurs **once per entry**, not every frame while standing on the tile.

### 4.3 Rendering

In `drawMaze()`:

- For `t === 7`:
  - Draw a light-colored base tile.
  - Draw a cross (both axes).
  - Use `getSwitchAt(r, c)` to highlight the active axis:
    - Vertical: highlight vertical line.
    - Horizontal: highlight horizontal line.

---

## 5. Bridges & Portals

### 5.1 Bridges (Tile 6)

Behavior:

- Treated exactly like floor for:
  - Movement (`blocked` only checks walls).
  - Dot placement (`seedDotsFromMaze` places dots on `6`).

Rendering:

- In `drawMaze()`:
  - Light floor fill (`#eef2ff`).
  - Inset stroked rectangle to suggest elevation.

### 5.2 Portals / Tunnels (Tile 5)

Behavior:

- Side-wrap portals remain implemented via `applyPortal(entity)`:
  - If `entity` is on a portal tile at left or right edges (col `0` or `COLS - 1`), warp to the opposite side.
- All portal/tunnel variants still use tile code `5`.
- `buildPortalsFromMaze` pairs all portal tiles, which can later support:
  - Non-side tunnels.
  - Under-bridge tunnels with different teleport semantics.

Rendering:

- In `drawMaze()`:
  - Tile `5` is drawn with a soft accent fill to distinguish it from normal floor.

---

## 6. Level Progression & UI

### 6.1 Progression

- Dot collection:
  - `updateDots()` removes dots at the player’s tile and increments score.
  - When `dots.size === 0`:
    - If more levels remain:
      - `loadLevel(currentLevelIndex + 1, { resetScore: false, showIntro: true })`.
    - Else:
      - `gameState = STATE.WIN`.

- Starting / restarting:
  - `startGame()` calls `loadLevel(0, { resetScore: true, showIntro: true })`.
  - Space / Start button when in `TITLE`, `GAMEOVER`, or `WIN` triggers `startGame()`.

### 6.2 HUD

- DOM elements:
  - `#score` – score text.
  - `#level` – level display (`Level: X / N`).
  - `#status` – state message.

- `updateUI()`:
  - Updates `score`, `status`, and `level` text.

### 6.3 Overlays

- `drawOverlay(text, color)` draws a centered overlay with a title and helper text.
- `draw()` chooses overlay based on:
  - `levelIntroTimer > 0` → show level intro (`"Level X: Name"`).
  - Else, if:
    - `STATE.TITLE` → `"Unicorn Run"`.
    - `STATE.GAMEOVER` → `"Game Over"`.
    - `STATE.WIN` → `"You Win!"`.

The game loop decrements `levelIntroTimer` and **freezes gameplay updates** while it is positive, so level intros act like short pauses.

---

## 7. Testing Notes (Desktop)

Suggested manual checks:

1. Level 1 (Classic)\n   - Plays like v1.1: movement, gem logic, unicorn chase, portals.\n2. Level transitions\n   - Collect all dots on Level 1 → Level 2 intro overlay appears and new maze loads.\n   - Repeat to reach Level 3, then WIN on final completion.\n3. Bridges\n   - Player/unicorn can walk over bridge tiles.\n   - Dots appear on bridges and are collectible.\n4. Switches\n   - Player entry toggles the switch’s orientation.\n   - Exits along forbidden axes are blocked for both player and unicorn.\n   - Unicorn does not toggle switches.\n5. HUD & overlays\n   - Level display updates (`Level: X / 3`).\n   - Appropriate messages for title, game over, win, and level intros.\n\nMobile behavior should remain roughly as in v1.1 (joysticks visible on small screens), but v1.2 focuses primarily on desktop correctness.\n*** End Patch```} ***!

