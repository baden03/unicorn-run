# Unicorn AI Rules

## Core Rules

1. **Decision Points**: The unicorn ONLY makes direction decisions at:
   - **Intersections**: 3-way or 4-way junctions (2+ valid non-reverse directions)
   - **Corners**: L-shaped turns (1 valid non-reverse direction, but 2+ total valid directions)

2. **Straight Corridors**: When moving in a straight corridor (only forward/backward valid), the unicorn keeps its current direction and does NOT make decisions.

3. **Greedy Chase Algorithm** (at intersections/corners):
   - Compare horizontal distance (`distX`) vs vertical distance (`distY`) to player
   - Try moving in the **dominant direction first** (whichever axis has greater distance)
   - If the dominant direction is blocked, try the other axis
   - Always choose the direction that **reduces distance** to the player

4. **Random Mode** (when would reverse):
   - If the chosen direction would cause the unicorn to reverse (go backwards), enter random mode
   - In random mode: make random direction choices for the next 2 intersections
   - After 2 random intersections, return to greedy chase

5. **Avoid Mode** (when player is invincible):
   - Same algorithm as chase, but choose directions that **increase distance** from player
   - Try to move away from the player

6. **Movement Constraints**:
   - Respects bridge/tunnel orientation restrictions
   - Respects switch blocking
   - Cannot turn onto bridges from tunnels
   - Cannot reverse direction (except when stuck)

7. **Decision Frequency**:
   - Only ONE decision per intersection/corner
   - Must be close to tile center (within ~1-2 pixels) to make decision
   - Once a decision is made at an intersection, don't make another until reaching a new intersection

## Implementation Details

- **Intersection Detection**: `validNonReverse.length >= 2` (3-way or 4-way)
- **Corner Detection**: `validNonReverse.length === 1 && valid.length >= 2` (L-turn)
- **Center Threshold**: Very small (1-2 pixels) to ensure precise alignment
- **Distance Calculation**: Uses Euclidean distance, compares `distX` vs `distY` for dominant axis

