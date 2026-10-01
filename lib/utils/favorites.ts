'use client';

import type { Song } from '@/lib/types';

const FAVORITES_STORAGE_KEY = 'okekaraoke_favorite_songs';

export function getFavoriteSongs(): Song[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isSongFavorited(song: Song): boolean {
  if (!song) return false;
  const favorites = getFavoriteSongs();
  return favorites.some(
    (s) => (song.id && s.id === song.id) || (song.code && song.code !== 'YT' && s.code === song.code)
  );
}

export function toggleFavoriteSong(song: Song): boolean {
  if (!song) return false;
  const favorites = getFavoriteSongs();
  const index = favorites.findIndex(
    (s) => (song.id && s.id === song.id) || (song.code && song.code !== 'YT' && s.code === song.code)
  );

  let isNowFavorited = false;

  if (index >= 0) {
    favorites.splice(index, 1);
    isNowFavorited = false;
  } else {
    favorites.unshift(song);
    isNowFavorited = true;
  }

  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new Event('okekaraoke_favorites_updated'));
  } catch (e) {
    console.warn('Failed to save favorites to localStorage:', e);
  }

  return isNowFavorited;
}
