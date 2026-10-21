// ============================================================
// OKEKARAOKE — Offline Storage Engine (IndexedDB)
// Saves full songs & media blobs locally on device storage (Android & iOS Safari)
// Zero Supabase storage usage — 100% client-side device storage
// ============================================================

export interface DownloadedSong {
  id: string;
  code: string;
  title: string;
  artist: string;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  thumbnail_data?: string | null; // Cached Base64 data URL for 100% offline display without internet
  song_type: string | null;
  category: string | null;
  downloaded_at: string;
  file_size_bytes: number;
  mime_type: string;
  media_data?: ArrayBuffer; // Stored as ArrayBuffer for 100% universal iOS Safari & Android support
  duration_seconds?: number;
}

export interface StorageUsage {
  count: number;
  totalBytes: number;
  formattedSize: string;
}

const DB_NAME = 'okekaraoke_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_songs';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      return reject(new Error('IndexedDB is only supported in browser environments.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_date', 'downloaded_at', { unique: false });
        store.createIndex('by_code', 'code', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetch all downloaded songs from device IndexedDB storage
 */
export async function getDownloadedSongs(): Promise<DownloadedSong[]> {
  if (!isBrowser()) return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as DownloadedSong[]) || [];
        // Sort newest first
        list.sort((a, b) => new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get downloaded songs:', err);
    return [];
  }
}

/**
 * Check if a specific song is downloaded on this device
 */
export async function isSongDownloaded(songId: string): Promise<boolean> {
  if (!isBrowser() || !songId) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(songId);

      request.onsuccess = () => resolve(Boolean(request.result));
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get a single downloaded song with its media data
 */
export async function getDownloadedSong(songId: string): Promise<DownloadedSong | null> {
  if (!isBrowser() || !songId) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(songId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to get downloaded song:', err);
    return null;
  }
}

/**
 * Universally find a downloaded song across any identifier:
 * DB id, youtube_video_id, or song code (guarantees offline match in Mini TV)
 */
export async function findDownloadedSong(criteria: {
  id?: string | null;
  youtube_video_id?: string | null;
  code?: string | null;
  title?: string | null;
}): Promise<DownloadedSong | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as DownloadedSong[]) || [];
        const match = list.find((item) => {
          if (criteria.id && item.id === criteria.id) return true;
          if (criteria.youtube_video_id && item.youtube_video_id && item.youtube_video_id === criteria.youtube_video_id) return true;
          if (criteria.code && item.code && item.code !== 'YT' && item.code === criteria.code) return true;
          if (criteria.id && item.youtube_video_id && item.youtube_video_id === criteria.id) return true;
          if (criteria.youtube_video_id && item.id && item.id === criteria.youtube_video_id) return true;
          if (criteria.title && item.title && item.title.toLowerCase().trim() === criteria.title.toLowerCase().trim()) return true;
          return false;
        });
        resolve(match || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save or update a song in device local storage (IndexedDB)
 */
export async function saveDownloadedSong(song: DownloadedSong): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(song);

    request.onsuccess = () => {
      notifyDownloadsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a downloaded song from device local storage
 */
export async function deleteDownloadedSong(songId: string): Promise<void> {
  if (!isBrowser() || !songId) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(songId);

    request.onsuccess = () => {
      notifyDownloadsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all downloaded songs from device local storage
 */
export async function clearAllDownloads(): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      notifyDownloadsChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Calculate total device storage used by OkeKaraoke downloads
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const songs = await getDownloadedSongs();
  let totalBytes = 0;
  for (const song of songs) {
    totalBytes += song.file_size_bytes || 0;
  }

  let formattedSize = '0 MB';
  if (totalBytes < 1024 * 1024) {
    formattedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else if (totalBytes < 1024 * 1024 * 1024) {
    formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    formattedSize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return {
    count: songs.length,
    totalBytes,
    formattedSize,
  };
}

/**
 * Create an HTML5 playable Blob URL from stored ArrayBuffer
 */
export function createSongMediaUrl(song: DownloadedSong): string | null {
  if (!song.media_data) return null;
  try {
    const blob = new Blob([song.media_data], { type: song.mime_type || 'video/mp4' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to create Blob URL:', err);
    return null;
  }
}

/**
 * Synthesizes a valid, universally playable audio media package (WAV PCM)
 * Supported 100% natively on iOS Safari, Android Chrome, and all web platforms without network
 */
function createPlayableKaraokeBuffer(durationSeconds = 210): ArrayBuffer {
  const sampleRate = 11025; // 11kHz for lightweight offline footprint (~4.6MB for 3.5 mins)
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Soft rhythm cadence for realistic karaoke accompaniment feel
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = (i % (sampleRate / 2)) < 200 ? 0.05 : 0;
    const melody = Math.sin(2 * Math.PI * 220 * t) * 0.02 * Math.exp(-((t % 1) * 3));
    const sample = Math.round((beat + melody) * 32767);
    view.setInt16(44 + i * 2, sample, true);
  }

  return buffer;
}

/**
 * Extracts a crisp video frame from an ArrayBuffer video stream using offscreen <video> + <canvas>
 * Works 100% locally on device without network (Airplane mode supported)
 */
export function extractVideoFrameFromBuffer(
  mediaData: ArrayBuffer,
  mimeType = 'video/mp4',
  seekTime = 2
): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return resolve(null);
    try {
      const blob = new Blob([mediaData], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const cleanUp = () => {
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        try {
          URL.revokeObjectURL(blobUrl);
          video.removeAttribute('src');
          video.load();
        } catch {}
      };

      const timer = setTimeout(() => {
        cleanUp();
        resolve(null);
      }, 4000);

      video.onloadeddata = () => {
        const target = Math.min(seekTime, (video.duration || 10) / 4);
        video.currentTime = target > 0 ? target : 0.5;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            cleanUp();
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Canvas frame extraction failed:', e);
        }
        cleanUp();
        resolve(null);
      };

      video.onerror = () => {
        cleanUp();
        resolve(null);
      };

      video.src = blobUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Attempts to fetch a YouTube thumbnail converted to a Base64 data URL
 */
export async function fetchThumbnailDataUrl(
  videoId?: string | null,
  customUrl?: string | null
): Promise<string | null> {
  if (typeof window === 'undefined' || (!videoId && !customUrl)) return null;
  try {
    const params = new URLSearchParams();
    if (videoId) params.set('videoId', videoId);
    if (customUrl) params.set('url', customUrl);

    const res = await fetch(`/api/songs/thumbnail?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.dataUrl) return data.dataUrl;
    }
  } catch (err) {
    // Offline or server route unreachable
  }
  return null;
}

/**
 * Downloads a song and saves it into IndexedDB phone storage with live percentage progress
 */
export async function downloadAndSaveSong(
  song: {
    id: string;
    code?: string;
    title: string;
    artist: string;
    youtube_video_id?: string | null;
    thumbnail_url?: string | null;
    song_type?: string | null;
    category?: string | null;
    duration_seconds?: number | null;
  },
  onProgress?: (percent: number) => void
): Promise<DownloadedSong> {
  onProgress?.(10);

  let mediaBuffer: ArrayBuffer | undefined = undefined;
  let fileSize = 0;
  let mimeType = 'video/mp4';

  // Smooth progress increments while server extracts and encodes YouTube MP4
  let simulatedProgress = 10;
  const timer = setInterval(() => {
    if (simulatedProgress < 70) {
      simulatedProgress += 10;
      onProgress?.(simulatedProgress);
    }
  }, 700);

  // In parallel, fetch YouTube thumbnail data URL so it works 100% offline
  const thumbPromise = fetchThumbnailDataUrl(song.youtube_video_id, song.thumbnail_url);

  try {
    const videoId = song.youtube_video_id || '';
    const res = await fetch(
      `/api/songs/download?videoId=${encodeURIComponent(videoId)}&id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`
    );

    if (res.ok && res.body) {
      const detectedMime = res.headers.get('content-type') || '';
      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      // Only treat as real media if content-type is video, audio, or octet-stream
      if (detectedMime.includes('video') || detectedMime.includes('audio') || detectedMime.includes('octet-stream')) {
        mimeType = detectedMime;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            if (totalBytes > 0 && onProgress) {
              const streamPercent = Math.round((receivedBytes / totalBytes) * 100);
              const realProgress = Math.min(99, Math.max(simulatedProgress, streamPercent));
              onProgress(realProgress);
            } else if (onProgress) {
              simulatedProgress = Math.min(95, simulatedProgress + 5);
              onProgress(simulatedProgress);
            }
          }
        }

        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        mediaBuffer = combined.buffer;
        fileSize = totalLength;
      }
    }
  } catch (err) {
    console.warn('Network stream download fallback:', err);
  } finally {
    clearInterval(timer);
  }

  // If download failed or stream is incomplete, notify user instead of storing black-screen WAV
  if (!mediaBuffer || mediaBuffer.byteLength < 50000) {
    throw new Error('Could not download complete video stream. Please check connection and try again.');
  }

  onProgress?.(100);

  // Await parallel thumbnail fetch or extract frame directly from mediaBuffer
  let thumbnailData: string | null = null;
  try {
    thumbnailData = await thumbPromise;
  } catch {}

  if (!thumbnailData && mediaBuffer) {
    try {
      thumbnailData = await extractVideoFrameFromBuffer(mediaBuffer, mimeType, 2);
    } catch {}
  }

  const downloadedItem: DownloadedSong = {
    id: song.id || song.youtube_video_id || `offline_${Date.now()}`,
    code: song.code || 'YT',
    title: song.title,
    artist: song.artist,
    youtube_video_id: song.youtube_video_id || null,
    thumbnail_url: song.thumbnail_url || (song.youtube_video_id ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg` : null),
    thumbnail_data: thumbnailData,
    song_type: song.song_type || 'Karaoke',
    category: song.category || 'General',
    downloaded_at: new Date().toISOString(),
    file_size_bytes: fileSize,
    mime_type: mimeType,
    media_data: mediaBuffer,
    duration_seconds: song.duration_seconds || 210,
  };

  await saveDownloadedSong(downloadedItem);
  return downloadedItem;
}

/**
 * Background auto-repair: for any previously downloaded song missing thumbnail_data,
 * automatically extract the frame from local video media_data or fetch thumbnail
 */
export async function repairMissingThumbnails(): Promise<number> {
  if (!isBrowser()) return 0;
  try {
    const list = await getDownloadedSongs();
    const needsRepair = list.filter((s) => !s.thumbnail_data);
    if (needsRepair.length === 0) return 0;

    let repairedCount = 0;
    for (const item of needsRepair) {
      try {
        let dataUrl: string | null = null;

        // 1. Try server fetch if online
        if (typeof navigator !== 'undefined' && navigator.onLine && item.youtube_video_id) {
          dataUrl = await fetchThumbnailDataUrl(item.youtube_video_id, item.thumbnail_url);
        }

        // 2. Fall back to local video frame extraction (works 100% offline)
        if (!dataUrl) {
          const full = await getDownloadedSong(item.id);
          if (full?.media_data) {
            dataUrl = await extractVideoFrameFromBuffer(full.media_data, full.mime_type, 2);
          }
        }

        if (dataUrl) {
          item.thumbnail_data = dataUrl;
          await saveDownloadedSong(item);
          repairedCount++;
        }
      } catch (err) {
        console.warn('Failed thumbnail repair for', item.title, err);
      }
    }

    if (repairedCount > 0) {
      notifyDownloadsChanged();
    }
    return repairedCount;
  } catch (err) {
    console.error('repairMissingThumbnails failed:', err);
    return 0;
  }
}

// Custom event to notify components across the app in real-time
export const DOWNLOADS_CHANGED_EVENT = 'okekaraoke_downloads_updated';

function notifyDownloadsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DOWNLOADS_CHANGED_EVENT));
  }
}
