# Unicorn Run
*Build a fast, cute, top-down maze game in HTML Canvas where the player collects gems while an angry unicorn chases them.*
**Version:** 1.1  
**Author:** Baden + Uviwe (8-years old) the one who begged to make a roblox game and she wanted to play it.

Play v1 of the borning non-roblox game at:
https://twinpictures.de/unicorn-run/

---

## 1. Goals
### 1.1 Primary Goal
Create a first-success game that is:
- Fun within the first hour of building
- Easy to understand and extend
- Built with HTML, CSS, and JavaScript

### 1.2 Design Goals
- Simple rules, immediate feedback (score goes up, gem respawns)
- Predictable physics and collisions using a tile-based maze (grid)
- Clean separation between game state, rendering, and input
- A clear roadmap for add-on projects (lives, power-ups, two player, smarter AI)
- Runs seamlessly on Desktop and Mobile devices

---

## 2. Game Summary
Unicorn Run is a top-down, Pac-Man-clone chase game:
- The player navigates a maze eating dots.
- Each dot increases score.
- When all dots are gone, the next maze is loaded.
- An angry unicorn chases the player.
- Getting caught ends the game in the MVP (later becomes “lose a heart and respawn”).
- A gem is randomly spawned on the maze.
- Eating a gem makes the player invincible to the unicorn for a number of seconds.

---

## 3. Core Mechanics
### 3.1 Maze (Tile Grid)
Use a grid-based maze to simplify collisions and movement logic.
- Maze is a 2D array: maze[row][col]
- Tile types:
  - 0 = floor (walkable)
  - 1 = wall (blocked)
  - 2 = corner
  - 3 = 3-way t intersection
  - 4 = 4-way x intersection
  - 5 = side portal wrap-around

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
- if the target tile is a corner, block movement along walled access
- if the target title is a 3-way, block movement along one axis
- if the target tile is a 4-way, allow 4 axis movement
- if th etarget tile is a portal, wrap the user to the other side of the maze.

This allows smooth motion while preserving simple collision rules.

### 3.3 Dots
Dots appear on all un travled floor titles.
- When collected:
  - score += 1

Dot collection:
- If player rectangle overlaps dot rectangle (or distance threshold), dot is collected

### 3.4 Gems
Gems appear on random floor tiles.
- Only spawn on floor tiles
- Do not spawn on player or unicorn tile
- When collected:
  - n seconds of invincibility, denoted by the unicorn cycling colors of the rainbow.
  - after the invincibility time, the unicorn returns to pink.
  - after a short time peirod respawn a new gem

Gem collection:
- If player rectangle overlaps gem rectangle (or distance threshold), gem is collected

### 3.4 Unicorn Chase (MVP AI)
Start with a simple chase so it is easy to build and debug.
- The unicorn moves at a constant speed
- At each intersection and corner, it chooses a 'greedy' direction that reduces distance to player:
  - Compare horizontal vs vertical distance
  - Try moving in the dominant direction first
  - If blocked by wall, try another free axis
  - If the selected free axis puts the unicorn in a reverse direction:
    - Switch to 'random' rules where the unicorn makes random axis selections on the next two intersections
    - return to 'greedy' rules

This “greedy + random chase” is not perfect pathfinding, but feels like a chase and is easy to understand.

### 3.5 Win/Lose Conditions (MVP)
MVP Lose:
- If unicorn collides with player when not not in invincible (rainbow unicorn mode): Game Over

MVP Win (optional):
- Collect all dots. Later multiple maze levels can be added

---

## 4. Visual Style (Cute, Clear, Minimal)
Canvas rendering should be simple shapes first, then upgraded to sprites later.

### 4.1 Rendering Palette (Conceptual)
- Walls: solid blocks
- Floor: light background
- Player: circle
- Unicorn: pink rounded rectangle + small triangle “horn”
- Dots: 1/3 size of player
- Gems: diamond shape or circle with sparkle strokes

### 4.2 UI Overlay
Draw HUD at top or above canvas:
- Score: 0+
- State: “Press Space or Button to Start”, “Game Over”, “You Win”
- A joysticks placed to the right of maze for mobile devices in landscape roatation and at the bottom of the maze in portrate orientation.
- Canvas is resized to fit mobile screen viewport

Use DOM for text UI if preferred (simpler), or draw text on canvas.

---

## 5. Controls
MVP controls:
- Arrow keys OR WASD OR Joystick on mobile devices
- Space and Start Button:
  - Start from title screen
  - Restart from game over

---

## 6. Technical Architecture
### 6.1 Files
Start with seperation of file types:
- index.html
- styles.css
- game.js

### 6.2 Game State
Recommended state variables:
- gameState: "title" | "playing_normal" | "playing_invincible" | "gameover" | "win"
- score: number
- maze: number[][]
- tileSize: number

Entities:
- player: { x, y, w, h, speed, dirX, dirY }
- unicorn: { x, y, w, h, speed }
- dots: number[][]
- gem: { x, y, w, h }
- invincible_time: number
- recovery_time: number

Input:
- keysDown: Set or object map (ArrowUp, ArrowDown, etc.)
- Start Button
- Joystick

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
- If any are walls, block that axis of movement