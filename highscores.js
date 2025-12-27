// v1.3.0 - High score logic and UI

import { MAX_HIGH_SCORES } from './config.js';
import { storage } from './storage.js';

// Format time in milliseconds to readable string (MM:SS.mmm)
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Check if a score qualifies for the high score table
export function checkQualifiesForHighScore(score, currentScores) {
  if (currentScores.length < MAX_HIGH_SCORES) return true;
  const lowestScore = currentScores[currentScores.length - 1].score;
  return score > lowestScore;
}

// Add a high score entry and return sorted list
export function addHighScore(entry, currentScores) {
  const newScores = [...currentScores, entry];
  // Sort by score descending, then by timestamp ascending (earlier is better for ties)
  newScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timestamp - b.timestamp;
  });
  // Keep only top N
  return newScores.slice(0, MAX_HIGH_SCORES);
}

// Get fastest time for a specific level
export function getFastestTimeForLevel(levelIndex, currentScores) {
  const levelScores = currentScores.filter(s => s.levelReached > levelIndex);
  if (levelScores.length === 0) return null;
  
  // Find fastest completion time for this level
  let fastest = null;
  for (const score of levelScores) {
    if (score.timing && score.timing.perLevelMs && score.timing.perLevelMs[levelIndex] !== undefined) {
      const levelTime = score.timing.perLevelMs[levelIndex];
      if (!fastest || levelTime < fastest.time) {
        fastest = { time: levelTime, name: score.name };
      }
    }
  }
  return fastest;
}

// High score entry UI state
let entryName = '';
let entryCallback = null;
let isMobile = false;

// Initialize high score entry UI
export function initHighScoreEntry(container, onComplete) {
  entryCallback = onComplete;
  entryName = '';
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Clear container
  container.innerHTML = '';
  
  // Create entry UI
  const wrapper = document.createElement('div');
  wrapper.className = 'high-score-entry';
  
  const title = document.createElement('h2');
  title.textContent = 'New High Score!';
  title.className = 'high-score-title';
  
  const prompt = document.createElement('p');
  prompt.textContent = 'Enter your name (5 letters):';
  prompt.className = 'high-score-prompt';
  
  const nameDisplay = document.createElement('div');
  nameDisplay.className = 'high-score-name-display';
  nameDisplay.textContent = '_____';
  updateNameDisplay(nameDisplay);
  
  const inputArea = document.createElement('div');
  inputArea.className = 'high-score-input-area';
  
  if (isMobile) {
    // Mobile: on-screen keyboard
    const keyboard = createOnScreenKeyboard(nameDisplay);
    inputArea.appendChild(keyboard);
  } else {
    // Desktop: keyboard input instructions
    const instructions = document.createElement('p');
    instructions.className = 'high-score-instructions';
    instructions.textContent = 'Type your name (A-Z only)';
    inputArea.appendChild(instructions);
    
    // Set up keyboard input
    const keyboardHandler = (e) => {
      if (e.key.length === 1 && /[A-Za-z]/.test(e.key)) {
        if (entryName.length < 5) {
          entryName += e.key.toUpperCase();
          updateNameDisplay(nameDisplay);
        }
      } else if (e.key === 'Backspace') {
        entryName = entryName.slice(0, -1);
        updateNameDisplay(nameDisplay);
      } else if (e.key === 'Enter' && entryName.length === 5) {
        submitEntry();
      }
    };
    
    document.addEventListener('keydown', keyboardHandler);
    entryCallback.cleanup = () => {
      document.removeEventListener('keydown', keyboardHandler);
    };
  }
  
  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn primary';
  confirmButton.textContent = 'Confirm';
  confirmButton.disabled = true;
  confirmButton.addEventListener('click', () => {
    if (entryName.length === 5) {
      submitEntry();
    }
  });
  
  // Update confirm button state
  const updateConfirmButton = () => {
    confirmButton.disabled = entryName.length !== 5;
  };
  
  const originalUpdateNameDisplay = updateNameDisplay;
  updateNameDisplay = (display) => {
    originalUpdateNameDisplay(display);
    updateConfirmButton();
  };
  
  function submitEntry() {
    if (entryName.length === 5 && entryCallback) {
      if (entryCallback.cleanup) entryCallback.cleanup();
      onComplete(entryName);
    }
  }
  
  wrapper.appendChild(title);
  wrapper.appendChild(prompt);
  wrapper.appendChild(nameDisplay);
  wrapper.appendChild(inputArea);
  wrapper.appendChild(confirmButton);
  container.appendChild(wrapper);
}

function updateNameDisplay(display) {
  const padded = entryName.padEnd(5, '_');
  display.textContent = padded.split('').join(' ');
}

function createOnScreenKeyboard(nameDisplay) {
  const keyboard = document.createElement('div');
  keyboard.className = 'on-screen-keyboard';
  
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rows = [
    letters.slice(0, 10),  // A-J
    letters.slice(10, 20), // K-T
    letters.slice(20, 26)  // U-Z
  ];
  
  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    
    row.split('').forEach(letter => {
      const key = document.createElement('button');
      key.className = 'keyboard-key';
      key.textContent = letter;
      key.addEventListener('click', () => {
        if (entryName.length < 5) {
          entryName += letter;
          updateNameDisplay(nameDisplay);
        }
      });
      rowEl.appendChild(key);
    });
    
    keyboard.appendChild(rowEl);
  });
  
  // Backspace button
  const controlsRow = document.createElement('div');
  controlsRow.className = 'keyboard-row keyboard-controls';
  
  const backspace = document.createElement('button');
  backspace.className = 'keyboard-key keyboard-backspace';
  backspace.textContent = '⌫';
  backspace.addEventListener('click', () => {
    entryName = entryName.slice(0, -1);
    updateNameDisplay(nameDisplay);
  });
  controlsRow.appendChild(backspace);
  
  keyboard.appendChild(controlsRow);
  
  return keyboard;
}

// Display high score table
export function displayHighScores(container, scores) {
  container.innerHTML = '';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'high-score-display';
  
  const title = document.createElement('h2');
  title.textContent = 'High Scores';
  title.className = 'high-score-title';
  
  const table = document.createElement('div');
  table.className = 'high-score-table';
  
  if (scores.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'high-score-empty';
    empty.textContent = 'No high scores yet. Be the first!';
    table.appendChild(empty);
  } else {
    scores.forEach((score, index) => {
      const row = document.createElement('div');
      row.className = 'high-score-row';
      
      const rank = document.createElement('span');
      rank.className = 'high-score-rank';
      rank.textContent = `${index + 1}.`;
      
      const name = document.createElement('span');
      name.className = 'high-score-name';
      name.textContent = score.name;
      
      const scoreValue = document.createElement('span');
      scoreValue.className = 'high-score-value';
      scoreValue.textContent = score.score.toLocaleString();
      
      const level = document.createElement('span');
      level.className = 'high-score-level';
      level.textContent = `L${score.levelReached}`;
      
      const time = document.createElement('span');
      time.className = 'high-score-time';
      time.textContent = formatTime(score.timing.totalMs);
      
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(scoreValue);
      row.appendChild(level);
      row.appendChild(time);
      table.appendChild(row);
    });
  }
  
  const continueButton = document.createElement('button');
  continueButton.className = 'btn primary';
  continueButton.textContent = 'Continue';
  continueButton.addEventListener('click', () => {
    // Trigger space key event to restart game (handled by handleSpace in game.js)
    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true });
    document.dispatchEvent(spaceEvent);
  });
  
  wrapper.appendChild(title);
  wrapper.appendChild(table);
  wrapper.appendChild(continueButton);
  container.appendChild(wrapper);
}

