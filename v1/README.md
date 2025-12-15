# Unicorn Run
*Build a fast, cute, top-down maze game in HTML Canvas where the player collects gems while an angry unicorn chases them.*
**Version:** 1.0  
**Author:** Baden + Uviwe (8-years old) the one who begged to make a roblox game and she wanted to play it.

Play the borning non-roblox game at:
https://twinpictures.de/unicorn-run/

---

## 1. Goals
### 1.1 Primary Goal
Create a first-success game that is:
- Fun within the first hour of building
- Easy to understand and extend
- Built with plain HTML, CSS, and JavaScript (no libraries)

### 1.2 Design Goals
- Simple rules, immediate feedback (score goes up, gem respawns)
- Predictable physics and collisions using a tile-based maze (grid)
- Clean separation between game state, rendering, and input
- A clear roadmap for add-on projects (lives, power-ups, two player, smarter AI)

---

## 2. Game Summary
Unicorn Run is a top-down, Pac-Man-style chase game:
- The player navigates a maze to collect gems.
- An angry unicorn chases the player.
- Each gem collected increases score.
- Getting caught ends the game in the MVP (later becomes “lose a heart and respawn”).

---

## 3. Core Mechanics
### 3.1 Maze (Tile Grid)
Use a grid-based maze to simplify collisions and movement logic.
- Maze is a 2D array: maze[row][col]
- Tile types:
  - 0 = floor (walkable)
  - 1 = wall (blocked)

Recommended tile size for Canvas:
- TILE = 32 px (good visibility and easy math)

Example maze dimensions:
- 15 rows x 21 cols (small enough for a first project)

### 3.2 Movement
Movement is grid-validated but can be rendered smoothly.
- Player and unicorn have positions in pixels (x, y)
- They also have implied grid positions (row, col) derived from pixels:
  - col = floor(x / TILE)
  - row = floor(y / TILE)

Movement approach (simple and reliable):
- Use velocity based on key input (dx, dy)
- Each frame, propose new position
- Convert proposed position to tile index
- If the target tile is a wall, block movement along that axis

This allows smooth motion while preserving simple collision rules.

### 3.3 Gems
Gems appear on random floor tiles.
- Only spawn on floor tiles
- Do not spawn on player or unicorn tile
- When collected:
  - score += 1
  - respawn a new gem

Gem collection:
- If player rectangle overlaps gem rectangle (or distance threshold), gem is collected

### 3.4 Unicorn Chase (MVP AI)
Start with a simple chase so it is easy to build and debug.
- The unicorn moves at a constant speed
- At each intersection and corner, it chooses a direction that reduces distance to player:
  - Compare horizontal vs vertical distance
  - Try moving in the dominant direction first
  - If blocked by wall, try the other axis
  - If both blocked, pick two random valid turns

This “greedy chase” is not perfect pathfinding, but feels like a chase and is easy.

### 3.5 Win/Lose Conditions (MVP)
MVP Lose:
- If unicorn collides with player: Game Over

MVP Win (optional):
- Collect N gems (e.g., 10) OR survive a timer (e.g., 30 seconds)

---

## 4. Visual Style (Cute, Clear, Minimal)
Canvas rendering should be simple shapes first, then upgraded to sprites later.

### 4.1 Rendering Palette (Conceptual)
- Walls: solid blocks
- Floor: light background
- Player: circle or rounded rectangle
- Unicorn: rounded rectangle + small triangle “horn”
- Gems: diamond shape or circle with sparkle strokes

### 4.2 UI Overlay
Draw HUD at top or above canvas:
- Score: 0+
- State: “Press Space to Start”, “Game Over”, “You Win”

Use DOM for text UI if preferred (simpler), or draw text on canvas.

---

## 5. Controls
MVP controls:
- Arrow keys OR WASD
- Space:
  - Start from title screen
  - Restart from game over

Optional:
- Shift for “dash” (later power-up or stamina)

---

## 6. Technical Architecture
### 6.1 Files
Start with a single file for quick success:
- index.html (includes CSS and JS in <style> and <script>)

Then expand into:
- index.html
- styles.css
- game.js

### 6.2 Game State
Recommended state variables:
- gameState: "title" | "playing" | "gameover" | "win"
- score: number
- maze: number[][]
- tileSize: number

Entities:
- player: { x, y, w, h, speed, dirX, dirY }
- unicorn: { x, y, w, h, speed }
- gem: { x, y, w, h }

Input:
- keysDown: Set or object map (ArrowUp, ArrowDown, etc.)

### 6.3 Game Loop
Use requestAnimationFrame for smooth rendering:
- update(deltaTime)
- draw()

Pseudo-structure:
- function loop(timestamp):
  - compute dt
  - if gameState === "playing": update(dt)
  - draw()
  - requestAnimationFrame(loop)

### 6.4 Collision Rules (Walls)
To prevent passing through walls:
- Handle X movement and Y movement separately (axis-aligned collision)
- On each axis:
  - propose new position
  - check if entity rectangle intersects any wall tiles
  - if collision, reject or clamp

Simplest wall test:
- Determine which tiles the entity would occupy after moving
- If any are walls, block that axis movement

---

## 7. Implementation Milestones (Success-Oriented)
### 7.1 Milestone 1: The Maze on Canvas
- Create canvas sized to maze dimensions (cols*TILE, rows*TILE)
- Draw walls and floors

Success check:
- You see a maze.

### 7.2 Milestone 2: Player Movement + Wall Blocking
- Add player entity
- Keyboard input
- Collision against walls

Success check:
- Player moves and cannot go through walls.

### 7.3 Milestone 3: Gem Spawn + Score
- Place gem randomly on floor
- Detect collection
- Increase score and respawn

Success check:
- Score increases as you collect gems.

### 7.4 Milestone 4: Unicorn Chase + Game Over
- Add unicorn entity
- Move unicorn toward player using greedy chase
- Detect player-unicorn collision

Success check:
- It feels like a chase game.

### 7.5 Milestone 5: Title Screen + Restart
- gameState transitions
- Space to start/restart

Success check:
- The game is complete and replayable.

---

## 8. Expansion Roadmap (Add-On Projects)
### 8.1 Lives / Hearts and Respawn
- lives = 3
- On catch:
  - lives -= 1
  - respawn player at start tile
  - respawn unicorn at its start tile
  - grant 1–2 seconds of invincibility

### 8.2 Power-Ups (Potions)
Spawn potion occasionally (e.g., every 8–12 seconds).
Types:
- Freeze Unicorn (3 seconds)
- Speed Boost (5 seconds)
- Shield (one hit negated)

Implementation:
- currentPowerUp: "none" | "freeze" | "speed" | "shield"
- powerUpTimerMs

### 8.3 Smarter Unicorn (Pathfinding)
Upgrade chase to BFS on the tile grid:
- Compute shortest path from unicorn tile to player tile
- Move unicorn along that path

This is a “big upgrade” but clean because the maze is a grid.

### 8.4 Two Player
Add player2:
- Player 1: WASD
- Player 2: Arrow keys

Modes:
- Co-op collecting gems
- Versus: one player controls unicorn (later)

### 8.5 Difficulty Scaling
- Unicorn speed increases every 5 gems
- Add a second unicorn after score reaches 10
- Add moving hazards later (optional)

### 8.6 Levels
- Maintain an array of mazes
- When score reaches threshold, load next maze
- Track best score per level

---

## 9. Content Customization (For Uviwe)
Theme hooks to keep it fun:
- Rename gems (sparkles, stars, crystals)
- Unicorn moods (angry, silly, sleepy)
- Victory messages
- Cute sound effects for gem pickup (optional)
- “Statue of Nevermore” as a special rare gem (later)

---

## 10. Definition of Done (MVP)
The MVP is done when:
- Maze renders on canvas
- Player moves with keys and is blocked by walls
- Gems spawn randomly on valid floor tiles
- Collecting gems increases score and respawns the gem
- Unicorn chases the player
- Collision with unicorn triggers Game Over
- Space key restarts the game

---

## 11. Next Step
Choose initial constraints for the first build:
- Maze size: 15x21 recommended
- Tile size: 32 px recommended
- Player speed: ~140 px/sec (tune later)
- Unicorn speed: ~110 px/sec (tune later)

Then build milestones 1–4 in order to get a working game fast.