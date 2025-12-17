## Unicorn Run v1.3 — Personalities, Persistence & Play Anywhere
*Evolve Unicorn Run into a character-driven, replayable arcade game with persistent high scores, multiple unicorn personalities, true over/under maze logic, and a mobile-first PWA foundation.*

**Version:** 1.3.0 
**Author:** Baden + Uviwe (8 years old)  
**Play here:** https://twinpictures.de/unicorn-run/

---

## 1. Vision for v1.3

Unicorn Run v1.3 focuses on **replayability, character, and persistence**.
While v1.2 introduced multi-level mazes and a maze factory, v1.3 asks a new question:

> *Why should players come back tomorrow?*

The answer is:
- The game **remembers you** (high scores).
- The unicorns are no longer identical — they have **personalities**.
- The maze gains **real depth** (true tunnels, not teleports).
- The game works **anywhere**, especially on mobile.

v1.3 deliberately stays high-level and stable, laying foundations for larger future expansions without overloading the core gameplay.

---

## 2. Where to Play

Unicorn Run is always playable at:

**https://twinpictures.de/unicorn-run/**

The same URL serves:
- Desktop browsers
- Mobile browsers
- Installed PWA version (v1.3+)

No separate app store installation is required.

---

## 3. Core Pillars of v1.3

### 3.1 Persistence & Replay (High Scores)

- Introduce a **classic arcade high-score table**
  - Track (and show) time to complete to determine point ties
  - Each *advanced* level should display fastest time & name on the HUD
- Players can enter a **five-letter name** when achieving a high score
- High scores are:
  - Saved locally for offline play
  - Synced when the device reconnects to the internet (PWA)
- Designed for **multiple players sharing one device**

This transforms Unicorn Run from a one-off experience into a competitive, replayable game.

---

### 3.2 Mobile-First PWA Foundation

v1.3 introduces Unicorn Run as a **Progressive Web App (PWA)**:

- Installable on mobile devices
- Runs in **full-screen**
- **Landscape-only** orientation enforced on mobile
- Offline-first gameplay
- Desktop support remains fully intact

The goal is not “cloud everything”, but:
> *The game should feel native, fast, and reliable anywhere.*

---

### 3.3 Unicorn Factory & Personalities

Unicorn Run v1.3 introduces a **Unicorn Factory**:

- Unicorns are defined in **structured data**, not hard-coded logic
- Each unicorn has:
  - A name
  - A personality
  - Distinct movement and chase behavior rules
- Early levels may include only one unicorn
- Later levels can include **multiple unicorns in the same maze**

Inspired by classic arcade design, each unicorn is:
- Predictable
- Learnable
- Dangerous in a different way

One early personality is explicitly planned:
- **“Drunk-y”** — unpredictable, sloppy movement, but sometimes accidentally brilliant

Detailed unicorn behavior rules live in [dev_notes](./dev_notes.md).

---

### 3.4 True Over / Under Maze Logic

Bridges and tunnels in v1.3 use **true over/under logic**, not repurposed portals:

- Entities can pass **under** a bridge while others move **over** it
- No teleportation shortcuts
- Movement respects physical maze layering

This is the first step toward:
- Vertical maze depth
- Multi-room layouts
- Future stairs and floors

v1.3 limits scope to **single-screen mazes with real tunnels**, keeping gameplay readable and fair.

---

### 3.5 Tutorial Path (Skippable)

To support new players and younger audiences, v1.3 introduces a **guided tutorial path**:

- Short, focused tutorial levels
- Each tutorial introduces **one concept at a time**:
  - Movement & Dots
  - Gems & Unicorn behavior
  - Bridges / tunnels
  - Switches
- Tutorial can be **skipped entirely** to jump straight into gameplay

The tutorial is built using the same level and maze systems as the main game.

---

### 3.6 Lives System (Forgiveness Without Complexity)

v1.3 adds a simple lives system:

- Players start with **3 lives**
- Losing a life resets positions but continues the run
- Extra lives can be earned through score milestones

No health bars, damage states, or hearts are introduced yet — the system remains intentionally simple and readable.

---

## 4. Game Summary (v1.3)

Unicorn Run remains a **top-down, tile-based chase game**:

- Collect dots to score points
- Grab gems for temporary invincibility
- Avoid (or chase) unicorns depending on state
- Learn unicorn personalities and maze rules
- Progress through multiple levels
- Compete for the high score

What changes in v1.3 is **depth, memory, and character**, not the core controls.

---

## 5. Scope for v1.3

### 5.1 In Scope
- High-score system & time with five-letter name entry
- Local persistence + offline support
- PWA installability and mobile-first layout
- Unicorn Factory with multiple personalities
- Multiple unicorns per maze (limited and controlled)
- True over/under tunnel logic
- Skippable tutorial path
- Lives system

### 5.2 Explicitly Out of Scope
- Online leaderboards
- User accounts or authentication
- User-generated maze uploads
- Procedural maze generation
- Multi-floor room transitions
- Health / damage systems
- 2.5D or full 3D rendering

These are intentionally deferred to future versions.

---

## 6. Architecture Notes (High-Level)

v1.3 builds directly on the v1.2 foundation:

- Maze creation remains isolated behind the **maze factory**
- Unicorn behavior is isolated behind the **unicorn factory**
- Game loop, input, and rendering remain stable
- New features are layered through data and configuration

All **low-level design, schemas, and algorithms** are documented in:

➡ **`dev_notes.md`**

This includes:
- High score data models
- Unicorn definition schema
- Tunnel / over-under collision rules
- PWA caching and sync strategy
- Tutorial level structure
- Testing and edge-case notes

---

## 7. Forward-Looking Direction (Beyond v1.3)

v1.3 intentionally prepares the ground for:

- Community maze designers and sharing
- Rated and curated mazes
- Multi-room and multi-floor levels
- Additional unicorn personalities
- Special NPCs and events
- Visual style experiments (2.5D / 3D spin-offs)

The guiding principle remains unchanged:

> **Keep the core game simple, readable, and fun —  
> let complexity emerge through rules, not controls.**

---

## 8. Version History

- **v1.3.0 (planned)** — High scores, PWA foundation, unicorn personalities, true tunnels, tutorial path
- **v1.2.1** — Pause support (desktop + mobile)
- **v1.2.0** — Multi-level mazes, maze factory, bridges, switches
- **v1.1.x** — Single-maze prototype and core mechanics