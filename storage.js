// v1.3.0 - Storage abstraction layer for high scores
// Prepared for future IndexedDB/cloud sync migration

import { HIGH_SCORE_STORAGE_KEY, HIGH_SCORE_SCHEMA_VERSION } from './config.js';

// Storage abstraction - currently uses localStorage, but structured for future IndexedDB
export const storage = {
  // Save high scores to storage
  async saveHighScores(scores) {
    try {
      const data = {
        version: HIGH_SCORE_SCHEMA_VERSION,
        scores: scores,
        timestamp: Date.now()
      };
      localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to save high scores:', error);
      return false;
    }
  },

  // Load high scores from storage
  async loadHighScores() {
    try {
      const stored = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      
      // Validate schema version (for future migrations)
      if (data.version !== HIGH_SCORE_SCHEMA_VERSION) {
        console.warn('High score schema version mismatch, clearing old data');
        this.clearHighScores();
        return [];
      }
      
      return data.scores || [];
    } catch (error) {
      console.error('Failed to load high scores:', error);
      return [];
    }
  },

  // Clear all high scores
  async clearHighScores() {
    try {
      localStorage.removeItem(HIGH_SCORE_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear high scores:', error);
      return false;
    }
  }
};

