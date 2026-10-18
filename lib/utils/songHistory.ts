'use client';

import type { Song, EnrichedQueueItem } from '@/lib/types';

export type HistorySong = Song | EnrichedQueueItem['song'];

export interface SongHistoryItem {
  id: string;
  song: HistorySong;
  playedAt: number; // Unix timestamp in ms
  roomCode?: string;
}

const HISTORY_STORAGE_KEY = 'okekaraoke_song_history';
const MAX_HISTORY_ITEMS = 100;

let memoryHistory: SongHistoryItem[] | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === HISTORY_STORAGE_KEY) {
      memoryHistory = null;
    }
  });
  window.addEventListener('okekaraoke_history_updated', () => {
    memoryHistory = null;
  });
}

export function getSongHistory(): SongHistoryItem[] {
  if (typeof window === 'undefined') return [];
  if (memoryHistory !== null) return memoryHistory;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      memoryHistory = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    memoryHistory = Array.isArray(parsed) ? parsed : [];
    return memoryHistory;
  } catch {
    memoryHistory = [];
    return [];
  }
}

export function addSongToHistory(song: HistorySong, roomCode?: string): void {
  if (!song || (!song.id && !song.youtube_video_id && !song.title)) return;
  if (typeof window === 'undefined') return;

  try {
    const history = getSongHistory();

    // Check if same song exists (by id, youtube_video_id, or title+artist)
    const existingIndex = history.findIndex((item) => {
      if (song.id && item.song.id && song.id === item.song.id) return true;
      if (
        song.youtube_video_id &&
        item.song.youtube_video_id &&
        song.youtube_video_id === item.song.youtube_video_id
      ) {
        return true;
      }
      if (
        song.title &&
        item.song.title &&
        song.title.toLowerCase().trim() === item.song.title.toLowerCase().trim() &&
        song.artist &&
        item.song.artist &&
        song.artist.toLowerCase().trim() === item.song.artist.toLowerCase().trim()
      ) {
        return true;
      }
      return false;
    });

    const newItem: SongHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      song: {
        ...song,
        // Ensure thumbnail is preserved
        thumbnail_url:
          song.thumbnail_url ||
          (song.youtube_video_id
            ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg`
            : ''),
      },
      playedAt: Date.now(),
      roomCode: roomCode || undefined,
    };

    if (existingIndex >= 0) {
      // Move to top with updated playedAt
      history.splice(existingIndex, 1);
    }

    history.unshift(newItem);

    // Limit to max items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.length = MAX_HISTORY_ITEMS;
    }

    memoryHistory = history;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    window.dispatchEvent(new Event('okekaraoke_history_updated'));
  } catch (e) {
    console.warn('Failed to save song history to localStorage:', e);
  }
}

export function removeSongFromHistory(historyId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getSongHistory();
    const updated = history.filter((item) => item.id !== historyId);
    memoryHistory = updated;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('okekaraoke_history_updated'));
  } catch (e) {
    console.warn('Failed to remove item from history:', e);
  }
}

export function clearSongHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    memoryHistory = [];
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    window.dispatchEvent(new Event('okekaraoke_history_updated'));
  } catch (e) {
    console.warn('Failed to clear song history:', e);
  }
}

const dateFormatCache = new Map<number, string>();

export function formatHistoryDate(timestamp: number): string {
  if (!timestamp) return '';
  const cached = dateFormatCache.get(timestamp);
  if (cached) return cached;

  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  let result = '';
  if (isToday) {
    result = `Today at ${timeStr}`;
  } else if (isYesterday) {
    result = `Yesterday at ${timeStr}`;
  } else if (date.getFullYear() === now.getFullYear()) {
    const monthStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    result = `${monthStr} at ${timeStr}`;
  } else {
    result = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  dateFormatCache.set(timestamp, result);
  return result;
}
