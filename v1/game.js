// Constants
const TILE_SIZE = 32;
const MAZE_ROWS = 15;
const MAZE_COLS = 21;
const PLAYER_SPEED = 140; // px/sec
const UNICORN_SPEED = 110; // px/sec
const CANVAS_WIDTH = MAZE_COLS * TILE_SIZE;
const CANVAS_HEIGHT = MAZE_ROWS * TILE_SIZE;

// Debug mode - set to true to enable console logging
const DEBUG = false;
// Debug verbosity: 'full' = log every frame, 'minimal' = log only issues, 'stuck' = log only when stuck, 'turns' = log turn attempts
const DEBUG_VERBOSITY = 'turns'; // 'full', 'minimal', 'stuck', or 'turns'

// Debug mode for unicorn AI - set to true to enable unicorn-specific logging
const DEBUG_UNICORN = true;
// Unicorn debug verbosity: 'full' = log every decision, 'intersections' = log only at intersections, 'blocked' = log when blocked
const DEBUG_UNICORN_VERBOSITY = 'intersections'; // 'full', 'intersections', or 'blocked'

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const statusElement = document.getElementById('status');
const startButton = document.getElementById('startButton');
const gameContainer = document.getElementById('gameContainer');

// Game state
let gameState = "title"; // "title" | "playing" | "gameover" | "win"
let score = 0;
let keysDown = new Set();
let lastTime = 0;

// Joystick state
let joystickState = {
    left: { active: false, dirX: 0, dirY: 0, touchId: null },
    right: { active: false, dirX: 0, dirY: 0, touchId: null }
};

// Initialize joysticks
const joystickLeft = document.getElementById('joystickLeft');
const joystickRight = document.getElementById('joystickRight');
const joystickLeftStick = document.getElementById('joystickLeftStick');
const joystickRightStick = document.getElementById('joystickRightStick');

function initJoysticks() {
    // Left joystick touch handlers
    joystickLeft.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickLeft.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickLeft.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickLeft.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
    
    // Right joystick touch handlers
    joystickRight.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickRight.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickRight.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickRight.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    const joystick = e.currentTarget;
    const isLeft = joystick.id === 'joystickLeft';
    const state = isLeft ? joystickState.left : joystickState.right;
    const touch = e.changedTouches[0];
    
    state.active = true;
    state.touchId = touch.identifier;
    joystick.classList.add('active');
    
    // Update joystick position based on touch
    updateJoystickPosition(touch, joystick, state, isLeft);
}

function handleJoystickMove(e) {
    e.preventDefault();
    const joystick = e.currentTarget;
    const isLeft = joystick.id === 'joystickLeft';
    const state = isLeft ? joystickState.left : joystickState.right;
    
    if (state.active && state.touchId !== null) {
        // Find the touch with matching identifier
        let touch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === state.touchId) {
                touch = e.touches[i];
                break;
            }
        }
        if (touch) {
            updateJoystickPosition(touch, joystick, state, isLeft);
        }
    }
}

function handleJoystickEnd(e) {
    e.preventDefault();
    const joystick = e.currentTarget;
    const isLeft = joystick.id === 'joystickLeft';
    const state = isLeft ? joystickState.left : joystickState.right;
    const stick = isLeft ? joystickLeftStick : joystickRightStick;
    
    // Check if this touch belongs to this joystick
    let touchFound = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === state.touchId) {
            touchFound = true;
            break;
        }
    }
    
    if (touchFound) {
        state.active = false;
        state.touchId = null;
        state.dirX = 0;
        state.dirY = 0;
        joystick.classList.remove('active');
        stick.style.transform = 'translate(-50%, -50%)';
    }
}

function updateJoystickPosition(touch, joystick, state, isLeft) {
    const stick = isLeft ? joystickLeftStick : joystickRightStick;
    
    // Get touch position relative to joystick center (recalculate on each touch)
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = (rect.width / 2) - 30; // Leave space for stick
    
    const touchX = touch.clientX - centerX;
    const touchY = touch.clientY - centerY;
    
    // Calculate distance and angle
    const distance = Math.sqrt(touchX * touchX + touchY * touchY);
    
    // Clamp to joystick radius
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(touchY, touchX);
    
    // Calculate stick position
    const stickX = Math.cos(angle) * clampedDistance;
    const stickY = Math.sin(angle) * clampedDistance;
    
    // Update stick visual position
    stick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    
    // Calculate normalized direction (-1 to 1)
    if (distance > 0) {
        // Use deadzone to prevent small movements
        const deadzone = 15;
        if (clampedDistance > deadzone) {
            const normalizedX = Math.cos(angle);
            const normalizedY = Math.sin(angle);
            
            // For grid-based movement, snap to cardinal directions
            const absX = Math.abs(normalizedX);
            const absY = Math.abs(normalizedY);
            
            if (absX > absY) {
                state.dirX = normalizedX > 0 ? 1 : -1;
                state.dirY = 0;
            } else {
                state.dirX = 0;
                state.dirY = normalizedY > 0 ? 1 : -1;
            }
        } else {
            state.dirX = 0;
            state.dirY = 0;
        }
    } else {
        state.dirX = 0;
        state.dirY = 0;
    }
}

// Initialize joysticks when page loads
initJoysticks();
// Also recalculate on resize
window.addEventListener('resize', initJoysticks);

// Maze definition (0 = floor, 1 = wall)
const maze = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,0,1,0,1,1,0,1,1,0,1,0,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Entities
let player = {
    x: TILE_SIZE * 1.5,
    y: TILE_SIZE * 1.5,
    w: 20,
    h: 20,
    speed: PLAYER_SPEED,
    dirX: 0,
    dirY: 0,
    desiredDirX: 0,
    desiredDirY: 0
};

let unicorn = {
    x: TILE_SIZE * 19.5,
    y: TILE_SIZE * 13.5,
    w: 24,
    h: 24,
    speed: UNICORN_SPEED,
    lastDirX: 0,
    lastDirY: 0,
    lastIntersectionGridX: null,
    lastIntersectionGridY: null
};

let gem = {
    x: 0,
    y: 0,
    w: 16,
    h: 16
};

// Helper functions
function pixelToGrid(x, y) {
    return {
        col: Math.floor(x / TILE_SIZE),
        row: Math.floor(y / TILE_SIZE)
    };
}

function gridToPixel(col, row) {
    return {
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2
    };
}

function isWallTile(row, col) {
    if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) {
        return true;
    }
    return maze[row][col] === 1;
}

function checkWallCollision(x, y, w, h) {
    // Check all four corners and center
    const points = [
        {x: x - w/2, y: y - h/2}, // top-left
        {x: x + w/2, y: y - h/2}, // top-right
        {x: x - w/2, y: y + h/2}, // bottom-left
        {x: x + w/2, y: y + h/2}, // bottom-right
        {x: x, y: y} // center
    ];

    for (let point of points) {
        const grid = pixelToGrid(point.x, point.y);
        if (isWallTile(grid.row, grid.col)) {
            return true;
        }
    }
    return false;
}

function getRandomFloorTile() {
    let attempts = 0;
    while (attempts < 100) {
        const row = Math.floor(Math.random() * MAZE_ROWS);
        const col = Math.floor(Math.random() * MAZE_COLS);
        if (maze[row][col] === 0) {
            const pixel = gridToPixel(col, row);
            // Check if tile is not occupied by player or unicorn
            const playerGrid = pixelToGrid(player.x, player.y);
            const unicornGrid = pixelToGrid(unicorn.x, unicorn.y);
            if (row !== playerGrid.row || col !== playerGrid.col) {
                if (row !== unicornGrid.row || col !== unicornGrid.col) {
                    return {x: pixel.x, y: pixel.y};
                }
            }
        }
        attempts++;
    }
    // Fallback: return center of first floor tile found
    for (let row = 0; row < MAZE_ROWS; row++) {
        for (let col = 0; col < MAZE_COLS; col++) {
            if (maze[row][col] === 0) {
                const pixel = gridToPixel(col, row);
                return {x: pixel.x, y: pixel.y};
            }
        }
    }
    return {x: TILE_SIZE * 10.5, y: TILE_SIZE * 7.5};
}

function spawnGem() {
    const pos = getRandomFloorTile();
    gem.x = pos.x;
    gem.y = pos.y;
}

function rectanglesOverlap(rect1, rect2) {
    return rect1.x - rect1.w/2 < rect2.x + rect2.w/2 &&
           rect1.x + rect1.w/2 > rect2.x - rect2.w/2 &&
           rect1.y - rect1.h/2 < rect2.y + rect2.h/2 &&
           rect1.y + rect1.h/2 > rect2.y - rect2.h/2;
}

// Input handling
document.addEventListener('keydown', (e) => {
    // Prevent arrow keys from scrolling the page
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
    
    keysDown.add(e.code);
    
    if (e.code === 'Space') {
        if (gameState === 'title' || gameState === 'gameover' || gameState === 'win') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
});

// Canvas scaling to fit viewport
function scaleCanvas() {
    // Use viewport dimensions for more accurate scaling, especially in landscape
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isLandscape = viewportWidth > viewportHeight;
    
    // Calculate available space (account for UI and joysticks)
    const uiHeight = 100; // Approximate UI height
    const joystickWidth = 120; // Joystick width on each side
    const availableWidth = viewportWidth - (joystickWidth * 2); // Space between joysticks
    const availableHeight = viewportHeight - uiHeight;
    
    // Use container dimensions as fallback, but prefer viewport for landscape
    const container = gameContainer;
    const containerWidth = isLandscape ? Math.min(availableWidth, container.clientWidth) : container.clientWidth;
    const containerHeight = isLandscape ? availableHeight : container.clientHeight;
    
    // Calculate scale to fit both dimensions while maintaining aspect ratio
    const scaleX = containerWidth / CANVAS_WIDTH;
    const scaleY = containerHeight / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
    
    // Apply scale transform
    canvas.style.width = (CANVAS_WIDTH * scale) + 'px';
    canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
}

// Start button handler - support both click and touch events
if (startButton) {
    console.log('start button found');
    const handleStart = (e) => {
        console.log('start button clicked');
        e.preventDefault();
        e.stopPropagation();
        if (gameState === 'title' || gameState === 'gameover' || gameState === 'win') {
            startGame();
        }
    };
    
    startButton.addEventListener('click', handleStart);
    startButton.addEventListener('touchstart', handleStart, { passive: false });
}
else{
    console.log('start button not found');
}

// Handle window resize and orientation change
window.addEventListener('resize', () => {
    scaleCanvas();
    // Reinitialize joystick positions after resize
    setTimeout(initJoysticks, 100);
});

window.addEventListener('orientationchange', () => {
    // Delay to allow orientation change to complete
    setTimeout(() => {
        scaleCanvas();
        initJoysticks();
    }, 100);
});

// Initial scale
scaleCanvas();

function startGame() {
    gameState = 'playing';
    score = 0;
    
    // Reset player position
    player.x = TILE_SIZE * 1.5;
    player.y = TILE_SIZE * 1.5;
    player.dirX = 0;
    player.dirY = 0;
    player.desiredDirX = 0;
    player.desiredDirY = 0;
    
    // Reset unicorn position and direction
    unicorn.x = TILE_SIZE * 19.5;
    unicorn.y = TILE_SIZE * 13.5;
    // Initialize direction towards player
    unicorn.lastDirX = -1;
    unicorn.lastDirY = 0;
    // Reset escape state
    unicorn.stuckTimer = 0;
    unicorn.escapeMode = false;
    unicorn.escapeCornerCount = 0;
    unicorn.lastPositionX = unicorn.x;
    unicorn.lastPositionY = unicorn.y;
    
    // Spawn gem
    spawnGem();
    
    updateUI();
}

// Debug function
function debugPlayerMovement(dt, newDirX, newDirY, gridX, gridY, nearGridX, nearGridY, atGridCenter) {
    if (!DEBUG) return;
    
    const grid = pixelToGrid(player.x, player.y);
    const moveX = player.dirX * player.speed * dt;
    const moveY = player.dirY * player.speed * dt;
    const newX = player.x + moveX;
    const newY = player.y + moveY;
    
    console.log('=== Player Movement Debug ===');
    console.log('Position:', { x: player.x.toFixed(2), y: player.y.toFixed(2) });
    console.log('Grid Position:', { row: grid.row, col: grid.col });
    console.log('Grid Center:', { x: gridX.toFixed(2), y: gridY.toFixed(2) });
    console.log('Current Direction:', { dirX: player.dirX, dirY: player.dirY });
    console.log('Desired Direction:', { desiredDirX: newDirX, desiredDirY: newDirY });
    console.log('Keys Pressed:', Array.from(keysDown));
    console.log('Near Grid:', { nearGridX, nearGridY });
    console.log('At Grid Center:', atGridCenter);
    console.log('Movement Amount:', { moveX: moveX.toFixed(2), moveY: moveY.toFixed(2) });
    console.log('Proposed Position:', { x: newX.toFixed(2), y: newY.toFixed(2) });
    console.log('Wall Collision X:', checkWallCollision(newX, player.y, player.w, player.h));
    console.log('Wall Collision Y:', checkWallCollision(player.x, newY, player.w, player.h));
    
    // Check surrounding tiles
    const surroundingTiles = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = grid.row + dr;
            const c = grid.col + dc;
            if (r >= 0 && r < MAZE_ROWS && c >= 0 && c < MAZE_COLS) {
                surroundingTiles.push({
                    row: r,
                    col: c,
                    isWall: isWallTile(r, c)
                });
            }
        }
    }
    console.log('Surrounding Tiles:', surroundingTiles);
    console.log('===========================');
}

// Update functions
function updatePlayer(dt) {
    // Handle input - store desired direction
    let newDirX = 0;
    let newDirY = 0;

    // Keyboard input
    if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) {
        newDirX = -1;
    }
    if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) {
        newDirX = 1;
    }
    if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) {
        newDirY = -1;
    }
    if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) {
        newDirY = 1;
    }
    
    // Joystick input (joysticks take precedence if active)
    if (joystickState.left.active || joystickState.right.active) {
        // Use left joystick if active, otherwise right
        const activeJoystick = joystickState.left.active ? joystickState.left : joystickState.right;
        if (activeJoystick.dirX !== 0 || activeJoystick.dirY !== 0) {
            newDirX = activeJoystick.dirX;
            newDirY = activeJoystick.dirY;
        }
    }

    // Store desired direction for intersection snapping
    player.desiredDirX = newDirX;
    player.desiredDirY = newDirY;

    // Get current grid center position
    let gridX = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    let gridY = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const snapThreshold = 10; // pixels - snap when close to center (more forgiving for chunky grid)

    // Check if we're close enough to a grid center to snap
    let nearGridX = Math.abs(player.x - gridX) < snapThreshold;
    let nearGridY = Math.abs(player.y - gridY) < snapThreshold;
    let nearGridCenter = nearGridX && nearGridY;
    
    // Check if we're exactly at grid center (before snapping)
    const atGridCenter = Math.abs(player.x - gridX) < 0.5 && Math.abs(player.y - gridY) < 0.5;
    
    // Snap to grid center selectively to enable turns without blocking movement
    const isStopped = player.dirX === 0 && player.dirY === 0;
    const isMovingHorizontally = player.dirX !== 0 && player.dirY === 0;
    const isMovingVertically = player.dirY !== 0 && player.dirX === 0;
    
    // Only snap when exactly at center (for turn detection) or when stopped
    // Don't snap when moving, as it prevents movement away from intersections
    if (atGridCenter) {
        // Exactly at center - snap to maintain precision
        player.x = gridX;
        player.y = gridY;
        // Recalculate after snap
        gridX = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        gridY = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        nearGridX = true;
        nearGridY = true;
        nearGridCenter = true;
    } else if (isStopped && nearGridCenter) {
        // Stopped and near intersection - snap for alignment
        player.x = gridX;
        player.y = gridY;
        gridX = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        gridY = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        nearGridX = true;
        nearGridY = true;
        nearGridCenter = true;
    } else if (isStopped && (nearGridX || nearGridY)) {
        // Stopped and near grid on one axis - snap that axis
        if (nearGridX) {
            player.x = gridX;
            gridX = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        }
        if (nearGridY) {
            player.y = gridY;
            gridY = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        }
    }

    // Recalculate nearGridCenter after snapping (for turn detection)
    // Use a larger threshold for turn detection to be more forgiving (40% of tile size)
    const turnDetectionThreshold = 12; // pixels - allow turns when close to center (more liberal for chunky grid)
    const nearGridXForTurn = Math.abs(player.x - gridX) < turnDetectionThreshold;
    const nearGridYForTurn = Math.abs(player.y - gridY) < turnDetectionThreshold;
    const nearGridCenterForTurn = nearGridXForTurn && nearGridYForTurn;
    
    // Recalculate atGridCenter after snapping (player position may have changed)
    const atGridCenterAfterSnap = Math.abs(player.x - gridX) < 0.5 && Math.abs(player.y - gridY) < 0.5;

    // Debug logging based on verbosity setting
    const hasInput = newDirX !== 0 || newDirY !== 0;
    const isMoving = player.dirX !== 0 || player.dirY !== 0;
    const isStuck = hasInput && !isMoving;
    
    if (DEBUG && DEBUG_VERBOSITY === 'full' && (hasInput || isMoving)) {
        debugPlayerMovement(dt, newDirX, newDirY, gridX, gridY, nearGridX, nearGridY, atGridCenterAfterSnap);
    } else if (DEBUG && DEBUG_VERBOSITY === 'turns' && atGridCenterAfterSnap && hasInput) {
        // Always log when at grid center with input to see what's happening
        console.log('📍 AT GRID CENTER - Input detected');
        console.log('  Position:', { x: player.x.toFixed(2), y: player.y.toFixed(2) });
        console.log('  Grid center:', { x: gridX.toFixed(2), y: gridY.toFixed(2) });
        console.log('  Current dir:', { dirX: player.dirX, dirY: player.dirY });
        console.log('  Input:', { newDirX, newDirY });
        console.log('  Keys:', Array.from(keysDown));
        debugPlayerMovement(dt, newDirX, newDirY, gridX, gridY, nearGridX, nearGridY, atGridCenterAfterSnap);
    } else if (DEBUG && (DEBUG_VERBOSITY === 'minimal' || DEBUG_VERBOSITY === 'stuck') && isStuck) {
        debugPlayerMovement(dt, newDirX, newDirY, gridX, gridY, nearGridX, nearGridY, atGridCenterAfterSnap);
    }

    // If at or near grid center, check if we can turn in desired direction
    if (nearGridCenterForTurn && hasInput) {
        // Determine if we want to change direction
        // Allow turn if: input direction is different from current direction
        const wantsHorizontal = newDirX !== 0 && newDirY === 0;
        const wantsVertical = newDirY !== 0 && newDirX === 0;
        const currentlyHorizontal = player.dirX !== 0 && player.dirY === 0;
        const currentlyVertical = player.dirY !== 0 && player.dirX === 0;
        const currentlyStopped = player.dirX === 0 && player.dirY === 0;
        
        // Check if we're trying to go in the same direction we're already going
        // Note: Check exact direction match, not just axis match
        const sameDirection = (wantsHorizontal && currentlyHorizontal && newDirX === player.dirX) ||
                             (wantsVertical && currentlyVertical && newDirY === player.dirY);
        
        // Check if we're trying to reverse direction (opposite on same axis)
        const wantsToReverse = (wantsHorizontal && currentlyHorizontal && newDirX !== player.dirX) ||
                               (wantsVertical && currentlyVertical && newDirY !== player.dirY);
        
        // Allow turn/start if: perpendicular turn, starting from stopped, or reversing direction
        // When stopped, we always want to start moving if there's input
        const shouldTurn = currentlyStopped || (!sameDirection && (wantsHorizontal || wantsVertical)) || wantsToReverse;

        if (DEBUG) {
            console.log('🎯 AT GRID CENTER - Player Movement Check');
            console.log('  State:', {
                'Moving': { X: player.dirX, Y: player.dirY },
                'Input': { X: newDirX, Y: newDirY },
                'Position': { x: player.x.toFixed(1), y: player.y.toFixed(1) }
            });
            console.log('  Turn check:', {
                'wantsHorizontal': wantsHorizontal,
                'wantsVertical': wantsVertical,
                'currentlyHorizontal': currentlyHorizontal,
                'currentlyVertical': currentlyVertical,
                'currentlyStopped': currentlyStopped,
                'sameDirection': sameDirection,
                'shouldTurn': shouldTurn
            });
        }

        if (shouldTurn) {
            // Test if the desired direction is valid (no wall)
            // Use grid positions after snapping
            if (wantsHorizontal) {
                // Want to move horizontally
                const testX = gridX + newDirX * TILE_SIZE * 0.1;
                const testGrid = pixelToGrid(testX, gridY);
                const targetTileIsWall = isWallTile(testGrid.row, testGrid.col);
                const canMoveX = !checkWallCollision(testX, gridY, player.w, player.h);
                
                if (DEBUG) {
                    const action = currentlyStopped ? 'START MOVING' : 'TURN ATTEMPT';
                    console.log(`  ✅ ${action}: Horizontal`);
                    console.log('    Testing -> Grid(' + testGrid.row + ',' + testGrid.col + ') =', targetTileIsWall ? 'WALL' : 'FREE');
                }
                
                if (canMoveX) {
                    player.dirX = newDirX;
                    player.dirY = 0;
                    if (DEBUG) {
                        const msg = currentlyStopped ? 'Movement started - now moving horizontally' : 'Turn successful - now moving horizontally';
                        console.log('  ✅ ' + msg);
                    }
                } else {
                    if (DEBUG) {
                        console.log('  ❌ Movement blocked - wall in the way');
                    }
                }
            } else if (wantsVertical) {
                // Want to move vertically
                const testY = gridY + newDirY * TILE_SIZE * 0.1;
                const testGrid = pixelToGrid(gridX, testY);
                const targetTileIsWall = isWallTile(testGrid.row, testGrid.col);
                const canMoveY = !checkWallCollision(gridX, testY, player.w, player.h);
                
                if (DEBUG) {
                    const action = currentlyStopped ? 'START MOVING' : 'TURN ATTEMPT';
                    console.log(`  ✅ ${action}: Vertical`);
                    console.log('    Testing -> Grid(' + testGrid.row + ',' + testGrid.col + ') =', targetTileIsWall ? 'WALL' : 'FREE');
                }
                
                if (canMoveY) {
                    player.dirX = 0;
                    player.dirY = newDirY;
                    if (DEBUG) {
                        const msg = currentlyStopped ? 'Movement started - now moving vertically' : 'Turn successful - now moving vertically';
                        console.log('  ✅ ' + msg);
                    }
                } else {
                    if (DEBUG) {
                        console.log('  ❌ Turn blocked - wall in the way');
                    }
                }
            }
        } else if (sameDirection) {
            // Same direction - verify path is clear and direction is set
            // This ensures movement continues even if direction was somehow cleared
            if (wantsHorizontal) {
                const testX = gridX + newDirX * TILE_SIZE * 0.1;
                const canMoveX = !checkWallCollision(testX, gridY, player.w, player.h);
                if (canMoveX) {
                    // Ensure direction is set (critical - direction might have been cleared)
                    player.dirX = newDirX;
                    player.dirY = 0;
                    if (DEBUG) {
                        console.log('  ✓ Continuing horizontal movement, direction ensured');
                    }
                } else {
                    // Blocked - stop movement
                    player.dirX = 0;
                    player.dirY = 0;
                    if (DEBUG) {
                        console.log('  ⚠️ Movement blocked in current direction, stopped');
                    }
                }
            } else if (wantsVertical) {
                const testY = gridY + newDirY * TILE_SIZE * 0.1;
                const canMoveY = !checkWallCollision(gridX, testY, player.w, player.h);
                if (canMoveY) {
                    // Ensure direction is set (critical - direction might have been cleared)
                    player.dirX = 0;
                    player.dirY = newDirY;
                    if (DEBUG) {
                        console.log('  ✓ Continuing vertical movement, direction ensured');
                    }
                } else {
                    // Blocked - stop movement
                    player.dirX = 0;
                    player.dirY = 0;
                    if (DEBUG) {
                        console.log('  ⚠️ Movement blocked in current direction, stopped');
                    }
                }
            }
            
            if (DEBUG) {
                console.log('  ℹ️ No turn needed - already moving in desired direction');
            }
        } else if (DEBUG) {
            if (wantsHorizontal && currentlyVertical) {
                console.log('  ⚠️ Perpendicular turn (vertical->horizontal) should happen but blocked by logic');
            } else if (wantsVertical && currentlyHorizontal) {
                console.log('  ⚠️ Perpendicular turn (horizontal->vertical) should happen but blocked by logic');
            } else {
                console.log('  ⚠️ Turn should happen but logic blocked it');
                console.log('    wantsHorizontal:', wantsHorizontal, 'wantsVertical:', wantsVertical);
                console.log('    currentlyHorizontal:', currentlyHorizontal, 'currentlyVertical:', currentlyVertical);
                console.log('    sameDirection:', sameDirection, 'wantsToReverse:', wantsToReverse);
            }
        }
    }

    // Stop player if no keys are pressed (player should only move when keys are pressed)
    if (!hasInput) {
        player.dirX = 0;
        player.dirY = 0;
    } else {
        // If player is stopped but has input, start moving (if not at grid center, we still allow starting movement)
        if (player.dirX === 0 && player.dirY === 0) {
            // Test if we can move in the desired direction
            if (newDirX !== 0 && newDirY === 0) {
                // Want to move horizontally
                const testX = player.x + newDirX * TILE_SIZE * 0.1;
                const canMoveX = !checkWallCollision(testX, player.y, player.w, player.h);
                if (canMoveX) {
                    player.dirX = newDirX;
                    player.dirY = 0;
                    if (DEBUG) {
                        console.log('🚀 Starting horizontal movement:', { dirX: player.dirX });
                    }
                }
            } else if (newDirY !== 0 && newDirX === 0) {
                // Want to move vertically
                const testY = player.y + newDirY * TILE_SIZE * 0.1;
                const canMoveY = !checkWallCollision(player.x, testY, player.w, player.h);
                if (canMoveY) {
                    player.dirX = 0;
                    player.dirY = newDirY;
                    if (DEBUG) {
                        console.log('🚀 Starting vertical movement:', { dirY: player.dirY });
                    }
                }
            }
        }
    }

    // Calculate new position based on current direction
    const moveX = player.dirX * player.speed * dt;
    const moveY = player.dirY * player.speed * dt;

    // Try X movement first
    let newX = player.x + moveX;
    const xBlocked = checkWallCollision(newX, player.y, player.w, player.h);
    if (!xBlocked) {
        player.x = newX;
    } else {
        // Stop if wall hit
        player.dirX = 0;
        // Recalculate grid position and snap if close
        const currentGridX = Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        if (Math.abs(player.x - currentGridX) < snapThreshold) {
            player.x = currentGridX;
        }
        if (DEBUG) {
            console.log('X movement blocked, snapped to grid');
        }
    }

    // Then Y movement
    let newY = player.y + moveY;
    const yBlocked = checkWallCollision(player.x, newY, player.w, player.h);
    if (!yBlocked) {
        player.y = newY;
    } else {
        // Stop if wall hit
        player.dirY = 0;
        // Recalculate grid position and snap if close
        const currentGridY = Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        if (Math.abs(player.y - currentGridY) < snapThreshold) {
            player.y = currentGridY;
        }
        if (DEBUG) {
            console.log('Y movement blocked, snapped to grid');
        }
    }

    // Debug: Log if player is stuck (has input but not moving)
    if (DEBUG && (newDirX !== 0 || newDirY !== 0) && player.dirX === 0 && player.dirY === 0) {
        console.warn('⚠️ PLAYER STUCK - Has input but no movement direction!');
        console.warn('Input:', { newDirX, newDirY });
        console.warn('Position:', { x: player.x.toFixed(2), y: player.y.toFixed(2) });
        console.warn('Grid:', pixelToGrid(player.x, player.y));
    }
}

function debugUnicornAI(atIntersection, gridX, gridY, dx, dy, distX, distY, dominantAxis, firstAttempt, firstBlocked, fallbackAttempt, fallbackBlocked, chosenDir, randomFallback) {
    if (!DEBUG_UNICORN) return;
    
    // Filter based on verbosity
    if (DEBUG_UNICORN_VERBOSITY === 'intersections' && !atIntersection) return;
    if (DEBUG_UNICORN_VERBOSITY === 'blocked' && !firstBlocked && !fallbackBlocked) return;
    
    const grid = pixelToGrid(unicorn.x, unicorn.y);
    
    console.log('🦄 === Unicorn AI Debug ===');
    console.log('Position:', { x: unicorn.x.toFixed(2), y: unicorn.y.toFixed(2) });
    console.log('Grid Position:', { row: grid.row, col: grid.col });
    console.log('Grid Center:', { x: gridX.toFixed(2), y: gridY.toFixed(2) });
    console.log('Current Direction:', { dirX: unicorn.lastDirX, dirY: unicorn.lastDirY });
    console.log('At Intersection:', atIntersection);
    
    if (atIntersection) {
        console.log('Distance to Player:', { dx: dx.toFixed(2), dy: dy.toFixed(2), distX: distX.toFixed(2), distY: distY.toFixed(2) });
        console.log('Dominant Axis:', dominantAxis);
        console.log('First Attempt:', firstAttempt ? { x: firstAttempt.x, y: firstAttempt.y } : 'none');
        console.log('First Attempt Blocked:', firstBlocked);
        if (firstBlocked) {
            console.log('Fallback Attempt:', fallbackAttempt ? { x: fallbackAttempt.x, y: fallbackAttempt.y } : 'none');
            console.log('Fallback Blocked:', fallbackBlocked);
        }
        if (randomFallback) {
            console.log('⚠️ Both directions blocked - using random fallback');
        }
        console.log('Chosen Direction:', chosenDir ? { x: chosenDir.x, y: chosenDir.y } : 'none (stuck)');
    }
    
    console.log('========================');
}

function updateUnicorn(dt) {
    // Check if we're at/near a grid center (intersection or corner)
    const gridX = Math.floor(unicorn.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const gridY = Math.floor(unicorn.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    
    // Check if we're close enough to a grid center to make intersection decisions
    // Use a threshold that's tight enough to prevent premature decisions but allows reaching it
    const intersectionThreshold = 1.5; // pixels - close to center but achievable
    const nearGridX = Math.abs(unicorn.x - gridX) < intersectionThreshold;
    const nearGridY = Math.abs(unicorn.y - gridY) < intersectionThreshold;
    const atGridCenter = nearGridX && nearGridY;
    
    // Check if this is an ACTUAL intersection (multiple valid directions)
    // Only make decisions at real intersections/corners, not at every grid center along a path
    let isActualIntersection = false;
    if (atGridCenter) {
        const allDirections = [
            {x: 1, y: 0},   // Right
            {x: -1, y: 0},  // Left
            {x: 0, y: 1},   // Down
            {x: 0, y: -1}   // Up
        ];
        
        // Count valid directions (excluding going backwards)
        let validDirections = 0;
        for (let dir of allDirections) {
            // Don't count going backwards as a valid choice
            if (dir.x === -unicorn.lastDirX && dir.y === -unicorn.lastDirY) {
                continue;
            }
            const testX = gridX + dir.x * TILE_SIZE * 0.1;
            const testY = gridY + dir.y * TILE_SIZE * 0.1;
            if (!checkWallCollision(testX, testY, unicorn.w, unicorn.h)) {
                validDirections++;
            }
        }
        
        // Only consider it an intersection if there are 2+ valid directions (multiple paths)
        // This excludes straight corridors where only forward/backward are valid
        isActualIntersection = validDirections >= 2;
    }
    
    const atIntersection = atGridCenter && isActualIntersection;
    const isNewIntersection = unicorn.lastIntersectionGridX !== gridX || unicorn.lastIntersectionGridY !== gridY;
    
    if (atIntersection && isNewIntersection) {
        // Snap to grid center before making decision - ensures clean alignment
        unicorn.x = gridX;
        unicorn.y = gridY;
        // Track that we're making a decision at this intersection
        unicorn.lastIntersectionGridX = gridX;
        unicorn.lastIntersectionGridY = gridY;
        
        // Calculate distance to player
        const dx = player.x - unicorn.x;
        const dy = player.y - unicorn.y;
        const distX = Math.abs(dx);
        const distY = Math.abs(dy);

        // Compare horizontal vs vertical distance
        // Try moving in the dominant direction first
        let chosenDir = null;
        let firstAttempt = null;
        let firstBlocked = false;
        let fallbackAttempt = null;
        let fallbackBlocked = false;
        let randomFallback = false;
        const dominantAxis = distX > distY ? 'horizontal' : 'vertical';
        
        if (distX > distY) {
            // Horizontal distance is dominant - try horizontal first
            if (dx > 0) {
                // Player is to the right
                firstAttempt = {x: 1, y: 0};
                const testX = gridX + TILE_SIZE * 0.1;
                if (!checkWallCollision(testX, gridY, unicorn.w, unicorn.h)) {
                    chosenDir = {x: 1, y: 0};
                } else {
                    firstBlocked = true;
                }
            } else {
                // Player is to the left
                firstAttempt = {x: -1, y: 0};
                const testX = gridX - TILE_SIZE * 0.1;
                if (!checkWallCollision(testX, gridY, unicorn.w, unicorn.h)) {
                    chosenDir = {x: -1, y: 0};
                } else {
                    firstBlocked = true;
                }
            }
            
            // If blocked by wall, try the other axis
            if (!chosenDir) {
                if (dy > 0) {
                    fallbackAttempt = {x: 0, y: 1};
                    const testY = gridY + TILE_SIZE * 0.1;
                    if (!checkWallCollision(gridX, testY, unicorn.w, unicorn.h)) {
                        chosenDir = {x: 0, y: 1};
                    } else {
                        fallbackBlocked = true;
                    }
                } else {
                    fallbackAttempt = {x: 0, y: -1};
                    const testY = gridY - TILE_SIZE * 0.1;
                    if (!checkWallCollision(gridX, testY, unicorn.w, unicorn.h)) {
                        chosenDir = {x: 0, y: -1};
                    } else {
                        fallbackBlocked = true;
                    }
                }
            }
        } else {
            // Vertical distance is dominant - try vertical first
            if (dy > 0) {
                // Player is below
                firstAttempt = {x: 0, y: 1};
                const testY = gridY + TILE_SIZE * 0.1;
                if (!checkWallCollision(gridX, testY, unicorn.w, unicorn.h)) {
                    chosenDir = {x: 0, y: 1};
                } else {
                    firstBlocked = true;
                }
            } else {
                // Player is above
                firstAttempt = {x: 0, y: -1};
                const testY = gridY - TILE_SIZE * 0.1;
                if (!checkWallCollision(gridX, testY, unicorn.w, unicorn.h)) {
                    chosenDir = {x: 0, y: -1};
                } else {
                    firstBlocked = true;
                }
            }
            
            // If blocked by wall, try the other axis
            if (!chosenDir) {
                if (dx > 0) {
                    fallbackAttempt = {x: 1, y: 0};
                    const testX = gridX + TILE_SIZE * 0.1;
                    if (!checkWallCollision(testX, gridY, unicorn.w, unicorn.h)) {
                        chosenDir = {x: 1, y: 0};
                    } else {
                        fallbackBlocked = true;
                    }
                } else {
                    fallbackAttempt = {x: -1, y: 0};
                    const testX = gridX - TILE_SIZE * 0.1;
                    if (!checkWallCollision(testX, gridY, unicorn.w, unicorn.h)) {
                        chosenDir = {x: -1, y: 0};
                    } else {
                        fallbackBlocked = true;
                    }
                }
            }
        }

        // If both blocked, pick random valid turns
        if (!chosenDir) {
            randomFallback = true;
            const allDirections = [
                {x: 1, y: 0},   // Right
                {x: -1, y: 0},  // Left
                {x: 0, y: 1},   // Down
                {x: 0, y: -1}   // Up
            ];
            
            const validDirections = allDirections.filter(dir => {
                const testX = gridX + dir.x * TILE_SIZE * 0.1;
                const testY = gridY + dir.y * TILE_SIZE * 0.1;
                return !checkWallCollision(testX, testY, unicorn.w, unicorn.h);
            });

            if (validDirections.length > 0) {
                // Pick a random valid direction (but avoid reversing into where we just came from)
                const filtered = validDirections.filter(dir => 
                    !(dir.x === -unicorn.lastDirX && dir.y === -unicorn.lastDirY)
                );
                const choices = filtered.length > 0 ? filtered : validDirections;
                chosenDir = choices[Math.floor(Math.random() * choices.length)];
            }
        }

        // Debug logging
        debugUnicornAI(isActualIntersection, gridX, gridY, dx, dy, distX, distY, dominantAxis, 
                       firstAttempt, firstBlocked, fallbackAttempt, fallbackBlocked, chosenDir, randomFallback);

        // Apply chosen direction
        if (chosenDir) {
            unicorn.lastDirX = chosenDir.x;
            unicorn.lastDirY = chosenDir.y;
            if (DEBUG_UNICORN && DEBUG_UNICORN_VERBOSITY === 'intersections') {
                console.log('🦄 Applied direction:', { dirX: unicorn.lastDirX, dirY: unicorn.lastDirY });
            }
        }
    }
    
    // Debug logging for non-intersection frames (only if verbosity is 'full')
    if (!atIntersection && DEBUG_UNICORN && DEBUG_UNICORN_VERBOSITY === 'full') {
        debugUnicornAI(atIntersection, gridX, gridY, 0, 0, 0, 0, null, null, false, null, false, null, false);
    }

    // Ensure we have a valid direction
    if (unicorn.lastDirX === 0 && unicorn.lastDirY === 0) {
        // Initialize to a valid direction if needed
        const directions = [
            {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}
        ];
        for (let dir of directions) {
            const testX = unicorn.x + dir.x * unicorn.speed * dt;
            const testY = unicorn.y + dir.y * unicorn.speed * dt;
            if (!checkWallCollision(testX, testY, unicorn.w, unicorn.h)) {
                unicorn.lastDirX = dir.x;
                unicorn.lastDirY = dir.y;
                break;
            }
        }
    }

    // Calculate movement
    const moveAmountX = unicorn.lastDirX * unicorn.speed * dt;
    const moveAmountY = unicorn.lastDirY * unicorn.speed * dt;

    // Try X movement
    let newX = unicorn.x + moveAmountX;
    if (!checkWallCollision(newX, unicorn.y, unicorn.w, unicorn.h)) {
        unicorn.x = newX;
        // If we've moved away from the last intersection, clear the tracking so we can make new decisions
        if (unicorn.lastIntersectionGridX !== null) {
            const currentGridX = Math.floor(unicorn.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
            if (Math.abs(currentGridX - unicorn.lastIntersectionGridX) > TILE_SIZE / 2) {
                unicorn.lastIntersectionGridX = null;
                unicorn.lastIntersectionGridY = null;
            }
        }
        if (DEBUG_UNICORN && DEBUG_UNICORN_VERBOSITY === 'full') {
            console.log('🦄 Moved X:', { from: (unicorn.x - moveAmountX).toFixed(2), to: unicorn.x.toFixed(2), dirX: unicorn.lastDirX });
        }
    } else {
        // Hit wall - reverse direction
        if (DEBUG_UNICORN && (DEBUG_UNICORN_VERBOSITY === 'full' || DEBUG_UNICORN_VERBOSITY === 'blocked')) {
            console.log('🦄 Wall collision X-axis at', { x: unicorn.x.toFixed(2), y: unicorn.y.toFixed(2) }, 'reversing X direction');
        }
        unicorn.lastDirX = -unicorn.lastDirX;
    }

    // Try Y movement
    let newY = unicorn.y + moveAmountY;
    if (!checkWallCollision(unicorn.x, newY, unicorn.w, unicorn.h)) {
        unicorn.y = newY;
        // If we've moved away from the last intersection, clear the tracking so we can make new decisions
        if (unicorn.lastIntersectionGridY !== null) {
            const currentGridY = Math.floor(unicorn.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
            if (Math.abs(currentGridY - unicorn.lastIntersectionGridY) > TILE_SIZE / 2) {
                unicorn.lastIntersectionGridX = null;
                unicorn.lastIntersectionGridY = null;
            }
        }
        if (DEBUG_UNICORN && DEBUG_UNICORN_VERBOSITY === 'full') {
            console.log('🦄 Moved Y:', { from: (unicorn.y - moveAmountY).toFixed(2), to: unicorn.y.toFixed(2), dirY: unicorn.lastDirY });
        }
    } else {
        // Hit wall - reverse direction
        if (DEBUG_UNICORN && (DEBUG_UNICORN_VERBOSITY === 'full' || DEBUG_UNICORN_VERBOSITY === 'blocked')) {
            console.log('🦄 Wall collision Y-axis at', { x: unicorn.x.toFixed(2), y: unicorn.y.toFixed(2) }, 'reversing Y direction');
        }
        unicorn.lastDirY = -unicorn.lastDirY;
    }
}

function updateGem() {
    // Check if player collected gem
    if (rectanglesOverlap(player, gem)) {
        score += 1;
        spawnGem();
        updateUI();
        
        // Win condition: collect 10 gems
        if (score >= 10) {
            gameState = 'win';
            updateUI();
        }
    }
}

function checkGameOver() {
    // Check collision with unicorn
    if (rectanglesOverlap(player, unicorn)) {
        gameState = 'gameover';
        updateUI();
    }
}

function update(dt) {
    if (gameState !== 'playing') return;

    updatePlayer(dt);
    updateUnicorn(dt);
    updateGem();
    checkGameOver();
}

// Rendering functions
function drawMaze() {
    // Draw floor
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw walls
    ctx.fillStyle = '#333';
    for (let row = 0; row < MAZE_ROWS; row++) {
        for (let col = 0; col < MAZE_COLS; col++) {
            if (maze[row][col] === 1) {
                ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawRoundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawUnicorn() {
    // Body (rounded rectangle)
    ctx.fillStyle = '#FF69B4';
    drawRoundedRect(unicorn.x - unicorn.w/2, unicorn.y - unicorn.h/2, unicorn.w, unicorn.h, 4);
    ctx.fill();
    
    // Horn (triangle)
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(unicorn.x, unicorn.y - unicorn.h/2);
    ctx.lineTo(unicorn.x - 4, unicorn.y - unicorn.h/2 + 8);
    ctx.lineTo(unicorn.x + 4, unicorn.y - unicorn.h/2 + 8);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(unicorn.x - 4, unicorn.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(unicorn.x + 4, unicorn.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawGem() {
    // Diamond shape
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - gem.h/2);
    ctx.lineTo(gem.x + gem.w/2, gem.y);
    ctx.lineTo(gem.x, gem.y + gem.h/2);
    ctx.lineTo(gem.x - gem.w/2, gem.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Sparkle
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - gem.h/2 - 2);
    ctx.lineTo(gem.x, gem.y - gem.h/2 + 2);
    ctx.moveTo(gem.x - gem.w/2 - 2, gem.y);
    ctx.lineTo(gem.x - gem.w/2 + 2, gem.y);
    ctx.moveTo(gem.x, gem.y + gem.h/2 - 2);
    ctx.lineTo(gem.x, gem.y + gem.h/2 + 2);
    ctx.moveTo(gem.x + gem.w/2 - 2, gem.y);
    ctx.lineTo(gem.x + gem.w/2 + 2, gem.y);
    ctx.stroke();
}

function drawTitleScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Unicorn Run', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    
    ctx.font = '24px Arial';
    ctx.fillText('Collect gems while avoiding the unicorn!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    ctx.fillText('Use Arrow Keys or WASD to move', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    ctx.fillText('Press SPACE to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillText('Press SPACE to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
}

function drawWinScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('You Win!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillText('Press SPACE to play again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw game elements
    drawMaze();
    
    if (gameState === 'playing') {
        drawGem();
        drawPlayer();
        drawUnicorn();
    } else if (gameState === 'title') {
        drawTitleScreen();
    } else if (gameState === 'gameover') {
        drawGem();
        drawPlayer();
        drawUnicorn();
        drawGameOverScreen();
    } else if (gameState === 'win') {
        drawGem();
        drawPlayer();
        drawUnicorn();
        drawWinScreen();
    }
}

function updateUI() {
    scoreElement.textContent = `Score: ${score}`;
    
    // Show/hide start button on mobile
    if (startButton) {
        if (gameState === 'title' || gameState === 'gameover' || gameState === 'win') {
            startButton.classList.remove('hidden');
            // Update button text based on state
            if (gameState === 'title') {
                startButton.textContent = 'Start Game';
            } else if (gameState === 'gameover') {
                startButton.textContent = 'Restart';
            } else if (gameState === 'win') {
                startButton.textContent = 'Play Again';
            }
        } else {
            startButton.classList.add('hidden');
        }
    }
    
    if (gameState === 'title') {
        statusElement.textContent = 'Press Space to Start';
    } else if (gameState === 'playing') {
        statusElement.textContent = 'Collect 10 gems to win!';
    } else if (gameState === 'gameover') {
        statusElement.textContent = 'Press Space to Restart';
    } else if (gameState === 'win') {
        statusElement.textContent = 'Press Space to Play Again';
    }
}

// Game loop
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// Initialize
updateUI();
requestAnimationFrame(gameLoop);

