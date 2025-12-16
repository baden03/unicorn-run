## Unicorn Run v1.2 — Maze Factory & Multi‑Level Mazes
*Extend Unicorn Run from a single static maze into a level‑based game powered by a reusable maze factory, enabling multiple maze layouts, new tile types, and scalable difficulty.*

**Version:** 1.2.1  
**Author:** Baden + Uviwe (8 years old)  
**Live:** https://twinpictures.de/unicorn-run/

---

## 1. Goals

### 1.1 Primary Goal for v1.2
- **Evolve Unicorn Run** from a single‑maze v1.1 prototype into a **multi‑level** game.
- Keep the **core feel and controls** of v1.1, while making it easy to add new mazes and mechanics.
- Make the codebase friendlier for future add‑ons by isolating maze logic behind a **maze factory**.

### 1.2 Design Goals (Building on v1.1)
- **Simple rules, immediate feedback**  
  Players still eat dots, chase gems, and dodge the angry unicorn.
- **Tile‑based collisions**  
  Movement stays grid‑validated (same as v1.1), now across multiple mazes.
- **Clean separation of concerns**  
  Game loop, input, and entities stay mostly unchanged; v1.2 focuses on maze/level loading.
- **Extendable foundation**  
  The maze factory should make it trivial to add new level templates, tile types, and AI improvements later.

For the original v1.1 design goals and mechanics, see the `v1.1/README.md`.

---

## 2. Game Summary (v1.2)

Unicorn Run remains a **top‑down chase game** (Pac‑Man‑style):
- **Player** moves through a maze, eating dots to gain score.
- **Unicorn** chases the player using simple chase logic.
- **Gems** spawn periodically and give temporary invincibility (6 seconds).
- **Getting caught** when not invincible ends the run.
- **Score system**: Dots (+1), Gems (+5), Tagging unicorn while invincible (+10).

New in v1.2:
- **Multi-level progression**: The game now features 4 distinct levels with unique maze layouts.
- **Maze factory system**: Reusable factory that generates mazes based on level configuration.
- **Extended tile types**: 
  - **Bridges** (tile 6): Visual elevated paths that allow vertical crossing only.
  - **Switch tiles** (tile 7): Direction-gated intersections that toggle between vertical/horizontal modes.
  - **Portals** (tile 5): Teleportation points, including side wrap-around and bridge tunnels.
- **Pause functionality**:
  - Desktop: Press **Spacebar** to pause/resume during gameplay.
  - Mobile: **Pause button** in the HUD for easy access.
- **Level intro screens**: Brief overlay showing level name when starting a new level.
- **Mobile controls**: Dual joystick support for touch devices.

---

## 3. Scope for v1.2

### 3.1 In Scope
- **Level system**
  - List of level configs (id, name, type, size, flags).
  - `currentLevelIndex` and `loadLevel(index)` to move between levels.
- **Maze factory inside `game.js`**
  - Select a **template maze** based on level config.
  - Initialize **portals**, **switch tiles**, and **spawn positions**.
  - Seed **dots** based on traversable tiles.
- **Extended tile types (high‑level)**
  - Portals/tunnels (wrap‑around) using an existing tile code.
  - Bridges (visual over/under feel, but simple floor behavior).
  - Switch tiles that constrain movement directions at certain intersections.
- **HUD updates**
  - Display **current level** and optional level name.
  - Simple “Level X” / “You Win” / “Game Over” messages.

### 3.2 Out of Scope (Deferred)
- Procedural maze generation (v1.2 uses **hand‑crafted templates**).
- Advanced unicorn pathfinding using maze topology.
- New entity types (extra enemies, NPCs), power‑ups, lives/health bar, two‑player mode.
- **Persistent high score tracking** (planned for future PWA version with local storage/IndexedDB).

Details for data structures, helper functions, and collision rules live in `dev_notes.md` (to be added/expanded as implementation stabilizes).

---

## 4. Maze & Tile Model (High‑Level)

The maze is still a **2D integer grid**: `maze[row][col]`.

### 4.1 Core Tile Types
- **0 – Floor**: walkable.
- **1 – Wall**: blocks movement.
- **5 – Portal / Tunnel**: walkable tile that teleports the player/unicorn to a paired location.
- **6 – Bridge floor**: walkable tile, drawn as an elevated path (visual variety only in v1.2).
- **7 – Switch tile**: walkable intersection tile with **direction‑gated exits**.

In general:
- **Walkable tiles**: `{ 0, 5, 6, 7 }`
- **Blocked tiles**: `{ 1 }`

### 4.2 Portals and “Tunnels”
- Portals and tunnels **share the same tile code** (5).
- Differences in behavior (e.g., side wrap‑around vs. under‑bridge tunnel) are handled in logic, not with a separate tile code.
- Each level that uses portals must define **portal pairs** so entering one endpoint teleports to the other.

### 4.3 Switch Tiles (Concept)
- Represented in the grid with tile code **7**.
- Each switch has a **mode**:
  - `vertical`: allows exiting **up/down**, blocks **left/right**.
  - `horizontal`: allows exiting **left/right**, blocks **up/down**.
- Switches toggle mode when the **player enters** them, changing which directions are allowed next time.

The exact data structures (e.g., `switches = [{ row, col, mode }]`) are documented in `dev_notes.md`.

---

## 5. Level System

### 5.1 Level Configs
v1.2 introduces a **level list** in `game.js`, with one entry per level.  
A typical config includes:
- **id** and **name** (e.g., "Classic", "Bridges", "Switches").
- **rows/cols** for maze size.
- **type** tag (e.g., `'classic'`, `'bridges'`, `'switches'`) to help the factory pick templates.
- Flags such as **portals: true/false**.

**Current Levels (v1.2.1):**
1. **Classic** — Traditional maze layout with portals.
2. **Bridges** — Features bridge tiles that allow vertical crossing only.
3. **Switches** — Introduces switch tiles with direction-gated movement.
4. **Bridges+Switches** — Combines both bridge and switch mechanics for maximum challenge.

The game tracks:
- `currentLevelIndex` — index into the levels array.

### 5.2 Loading Levels
`loadLevel(index)` does the high‑level work of:
- Asking the **maze factory** for a maze based on the level config.
- Setting up maze‑specific metadata:
  - Portal pairs.
  - Switch tiles and their initial mode.
  - Player and unicorn spawn positions.
- Seeding **dots** across the maze according to high‑level rules (e.g., floors and bridges, optional switches).
- Soft‑resetting per‑level state:
  - Reset positions, dots, and per‑level timers.
  - Optionally keep score continuous across levels.

When all dots are collected:
- If a **next level exists**, increment `currentLevelIndex` and call `loadLevel(next)`.
- Otherwise, transition to a **WIN** state.

---

## 6. Maze Factory (Concept)

### 6.1 Approach in v1.2
The v1.2 maze factory is intentionally **simple**:
- It uses a **small library of hand‑crafted templates** (2D arrays) for each level type.
- On each run, it **selects** one template for the current level (optionally at random).
- It **annotates** the chosen template with portals, switches, and spawn points.

This gives “factory‑like” behavior (selection and setup) without needing full procedural generation.

### 6.2 Responsibilities
At a high level, the maze factory:
- **Creates mazes for levels**  
  e.g., `createMazeForLevel(levelConfig) -> { maze, portals, switches, spawns }`.
- **Picks a template** based on level type.  
  Different level types can emphasize:
  - Classic corridors (`'classic'`).
  - Bridges and vertical layering (`'bridges'`).
  - Switch tiles and direction puzzles (`'switches'`).
- **Seeds dots** by scanning the maze for traversable tiles and applying simple rules (e.g., no dots on spawn tiles, optional behavior for portal/switch tiles).
- Optionally **annotates topology** (intersections, dead ends, four‑ways) to support future AI improvements.

Exact function signatures and data structures belong in `dev_notes.md`.

---

## 7. Game Flow & UI (with Levels)

### 7.1 Game State Flow
v1.2 reuses the core game states from v1.1, but adds **level awareness**:
- **Start / Restart**
  - Set `currentLevelIndex = 0`.
  - Call `loadLevel(0)`.
  - Enter the playing state.
- **During play**
  - Update player and unicorn as before.
  - Check for dot collection and gem effects.
- **On all dots collected**
  - If more levels remain: advance to the next level and briefly show “Level X”.
  - If no more levels: show “You Win”.
- **On unicorn catching player (not invincible)**
  - Show “Game Over” as in v1.1.

### 7.2 HUD & Messages
The HUD displays:
- **Score** — cumulative score across all levels.
- **Level** — current level number and total (e.g., `Level 2 / 4`).
- **Status message** — contextual text (e.g., "Collect dots + gems!", "Invincible! Avoid walls.", "Paused").
- **Start/Restart button** — begins a new game or restarts the current run.
- **Pause/Resume button** — visible during gameplay on all devices, essential for mobile.

Overlays/messages:
- **Level intro**: "Level 1: Classic", "Level 2: Bridges", etc. (shown briefly when level starts).
- **Game states**: "Unicorn Run" (title), "Paused", "Game Over", "You Win!".
- **Instructions**: Context-appropriate prompts (e.g., "Press Space or Start", "Press Space or Resume").

### 7.3 Controls
- **Desktop**:
  - Arrow keys or WASD for movement.
  - Spacebar to start game, pause/resume during gameplay.
  - Start button for new game/restart.
- **Mobile**:
  - Dual joystick controls (left/right) for movement.
  - Pause/Resume button in HUD.
  - Start button for new game/restart.

---

## 8. Development Notes & Next Steps

### 8.1 Where to Put Low‑Level Details
To keep this `README.md` high‑level and friendly:
- **Implementation details** (tile codes, structs, helper signatures, collision edge cases) should live in **`dev_notes.md`**.
- This file can document:
  - Exact maze templates used in v1.2.
  - Data structures for portals, switches, and dots.
  - Collision helpers and switch‑exit rules.
  - Testing checklists for new levels and tiles.

### 8.2 Forward‑Looking Ideas (v1.3+ / PWA Version)
The v1.2 architecture is meant to support:
- **PWA (Progressive Web App) conversion**:
  - Offline play capability.
  - Installable on mobile devices.
  - **High score tracking** with persistent local storage (IndexedDB/localStorage).
  - Score leaderboards (local or cloud-synced).
- Swapping the template library with a **procedural maze generator**.
- Adding more tile types (hazards, ice, slow tiles, one‑way doors).
- Smarter **unicorn AI** that understands maze topology (dead ends, loops).
- Lives, power‑ups, and multiple players, all powered by the same level/maze factory.
- Sound effects and background music.
- Achievements and unlockable content.

The core principle for v1.2 and beyond:
- **Keep maze creation and level definition isolated behind the maze factory** so the main game loop stays stable while you experiment with new mazes and mechanics.

### 8.3 Version History
- **v1.2.1**: Added pause functionality (desktop spacebar + mobile pause button).
- **v1.2.0**: Initial multi-level release with maze factory, bridges, switches, and level progression.