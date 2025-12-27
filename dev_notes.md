# Unicorn Run v1.3 — Developer Notes
*Low-level technical notes, schemas, and implementation guidance for v1.3.*

**Version:** 1.3.0 
**Related README:** README.md  
**Play:** https://twinpictures.de/unicorn-run/

---

## 0. Purpose of This File

This document contains **all low-level details** intentionally omitted from `README.md`, including:

- Data structures
- Behavioral rules
- Engine extensions
- Edge cases
- Architectural constraints

Guiding principle:

README.md explains *what and why*  
dev_notes.md explains *how*

---

## 1. High-Level Architectural Constraints

v1.3 must not destabilize the v1.2 game loop.

The following systems remain unchanged:
- Main update loop
- Rendering cadence
- Input handling
- Grid-based movement validation

All new features are layered via:
- Factories (maze, unicorn)
- Data-driven configuration
- Minimal new global state

---

## 2. Game State Additions (v1.3)

### 2.1 New Game States

Recommended additions:
- ENTER_HIGH_SCORE
- SHOW_HIGH_SCORES

Existing states (START, PLAYING, PAUSED, GAME_OVER, WIN) remain valid.

State transitions should be explicit and centralized.

---

## 3. High Score System

### 3.1 Data Model

High scores are stored as a list of entries:

```js
{
  name: "ABCDE",              // 5-letter arcade name
  score: 12345,

  levelReached: 4,            // highest level reached
  levelsCompleted: 4,         // explicit, clearer than inferring

  timing: {
    totalMs: 215432,          // total run time in milliseconds
    perLevelMs: [
      53210,                  // Level 1
      48765,                  // Level 2
      61234,                  // Level 3
      42223                   // Level 4
    ]
  },

  deaths: 2,                  // optional but very useful
  unicornsDefeated: 5,        // optional future stat

  timestamp: 1700000000       // unix epoch (when run ended)
}
```

Constraints:
- Fixed-length name (5 chars)
- Uppercase A–Z only
- Stable sorting by score desc, then timestamp asc

### 3.2 Storage Strategy

- Primary: localStorage
- Optional mirror: IndexedDB (future)
- Cloud sync: out of scope for v1.3

Offline-first rule:
- Always write locally
- Never block gameplay on sync

### 3.3 Entry Flow

1. Game ends (win or game over)
2. Score qualifies for top N
3. Transition to ENTER_HIGH_SCORE
4. Capture name (keyboard or touch UI)
5. Persist score
6. Show high-score table

---

## 4. PWA Foundation

### 4.1 Requirements

- Installable via browser
- Full-screen mode
- Forced landscape orientation (mobile)
- Offline playable

### 4.2 Service Worker Scope

Cache:
- HTML
- CSS
- JS
- Image assets

Do not cache:
- Dynamic score data
- Remote APIs

Failure rule:
- If service worker fails, game runs as normal web app

---

## 5. Lives System

### 5.1 Rules

- Start with lives = 3
- On player death:
  - Decrement lives
  - Reset positions
  - Preserve score and level
- If lives reach 0:
  - Transition to GAME_OVER

### 5.2 Extra Lives

- Award 1 extra life every X points (e.g. 1000)
- Optional life cap (default: none)

No health bars or damage states in v1.3.

---

## 6. Unicorn Factory

### 6.1 Purpose

Unicorn behavior must be:
- Data-driven
- Predictable
- Extensible

### 6.2 Unicorn Definition Schema

```js
{
  id: "drunky",
  name: "Drunk-y",
  color: "#48CAE4",
  movement: {
    baseSpeed: 1.0,
    speedVariance: 0.3,
    turnDelayChance: 0.2
  },
  behavior: {
    chaseBias: 0.6,
    randomBias: 0.4,
    tunnelAwareness: false
  },
  invincibleResponse: "flee"
}
```

### 6.3 Core Unicorn Types

- classic — predictable chase logic
- drunky — random, delayed, chaotic

Unicorn count per level is controlled by level config.

---

## 7. Multiple Unicorns per Maze

### 7.1 Collision Rules

- Unicorns do not collide with each other
- Unicorns ignore each other entirely
- All share player collision and tunnel rules

### 7.2 Spawn Rules

- Each unicorn share a spawn tile
- Maze factory validates spawn safety

---

## 8. True Over / Under Tunnel Logic

### 8.1 Core Concept

Tiles may exist on layers:
- layer = 1 (tunnles)
- layer = 2 (floor and bridge)

Entities occupy exactly one layer at a time.

### 8.2 Tile Metadata Extension

```js
{
  row,
  col,
  tile,
  layer,
  allows: ["up", "down"]
}
```

### 8.3 Movement Rules

- An entity may only move onto tiles that exist on the **same layer**.
- **Tunnel entrances** explicitly change the entity’s layer (e.g. ground → underpass).
- **Layer changes are only allowed at designated tunnel tiles.**

- **Teleportation is allowed only for world-wrapping purposes**, such as:
  - Left ↔ right screen edges
  - Explicit portals defined by the maze

- Teleportation:
  - Does **not** change the entity’s layer
  - Must preserve the current layer
  - Must not be used to bypass over/under tunnel logic

In short:
- **Tunnels change layers**
- **Teleports change position**
- **No mechanic may substitute for the other**

---

## 9. Maze Factory (v1.3 Notes)

Responsibilities:
- Select template
- Assign layers
- Validate spawns
- Seed dots
- Attach unicorn count

Deferred:
- Procedural generation
- User-authored mazes

---

## 11. Input Considerations

### 11.1 Name Entry

Desktop:
- Arrow keys / WASD
- Enter to confirm

Mobile:
- On-screen letter selector
- Large touch targets
- No system keyboard required

---

## 12. Testing Checklist

- Offline play works
- High scores persist after reload
- Lives decrement correctly
- Multiple unicorns behave independently
- Tunnels respect layers
- Tutorial can be skipped
- Mobile landscape lock works
- Desktop still playable

---

## 13. Non-Goals

The following must not appear in v1.3:
- Online accounts
- Multiplayer
- Full 3D camera
- Physics-based movement
- Maze uploads

---
