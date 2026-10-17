'use client';

import type { Song, EnrichedQueueItem } from '@/lib/types';

export type FavoritableSong = Song | EnrichedQueueItem['song'];

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

export function isSongFavorited(song: FavoritableSong): boolean {
  if (!song) return false;
  const favorites = getFavoriteSongs();
  return favorites.some(
    (s) => (song.id && s.id === song.id) || (song.code && song.code !== 'YT' && s.code === song.code)
  );
}

export function toggleFavoriteSong(song: FavoritableSong): boolean {
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
    const songToSave: Song = {
      id: song.id,
      code: song.code || '',
      title: song.title,
      artist: song.artist,
      youtube_video_id: song.youtube_video_id ?? null,
      thumbnail_url: song.thumbnail_url ?? null,
      category: (song as Song).category ?? null,
      language: (song as Song).language ?? null,
      song_type: (song as Song).song_type ?? null,
      keywords: (song as Song).keywords ?? [],
      duration_seconds: song.duration_seconds ?? null,
      is_active: true,
      created_at: (song as Song).created_at || new Date().toISOString(),
      updated_at: (song as Song).updated_at || new Date().toISOString(),
    };
    favorites.unshift(songToSave);
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
