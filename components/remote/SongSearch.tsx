'use client';

// ============================================================
// OKEKARAOKE — Song Search Component
// Search songs by title, artist, or browse backend karaoke catalog
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import {
  Search,
  Music2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  X,
  Sparkles,
  Music,
  Mic,
  Radio,
  Flame,
  Headphones,
  Disc,
  Volume2,
  Star,
  LayoutGrid,
  List,
  Download,
  HardDrive,
  Check,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import type { Song } from '@/lib/types';
import { getFavoriteSongs, toggleFavoriteSong } from '@/lib/utils/favorites';
import {
  getDownloadedSongs,
  downloadAndSaveSong,
  DOWNLOADS_CHANGED_EVENT,
} from '@/lib/utils/offlineStorage';
import { OfflineSongThumbnail } from '@/components/remote/OfflineSongThumbnail';

interface SongSearchProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
  onReserved: (song?: Song, resultData?: any, tempIdToReplace?: string) => void;
  onReserveFailed?: (tempId: string) => void;
  reservedSongIds?: Set<string>;
  isSoloTVMode?: boolean;
}

interface SongWithReserving extends Song {
  _reserving?: boolean;
  _reserved?: boolean;
}

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Songs', icon: Music },
  { id: 'karaoke', label: 'Karaoke', icon: Mic },
  { id: 'opm', label: 'OPM', icon: Radio },
  { id: 'pop', label: 'Pop', icon: Sparkles },
  { id: 'rock', label: 'Rock', icon: Flame },
  { id: 'piano', label: 'Piano', icon: Headphones },
];

function renderSongTypeIcon(type?: string | null) {
  if (!type) return <Mic size={11} className="text-teal-400 shrink-0" />;
  const t = type.toLowerCase();
  if (t.includes('piano')) return <Headphones size={11} className="text-teal-400 shrink-0" />;
  if (t.includes('acoustic') || t.includes('guitar')) return <Disc size={11} className="text-teal-400 shrink-0" />;
  if (t.includes('band') || t.includes('drum') || t.includes('rock')) return <Flame size={11} className="text-teal-400 shrink-0" />;
  if (t.includes('instrumental')) return <Volume2 size={11} className="text-teal-400 shrink-0" />;
  return <Mic size={11} className="text-teal-400 shrink-0" />;
}

interface SongCardProps {
  song: Song;
  songStatus: { status: 'idle' | 'reserving' | 'success' | 'error'; message?: string };
  isFav: boolean;
  isAlreadyReserved: boolean;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  onToggleFav: (song: Song) => void;
  onReserve: (song: Song) => void;
  onDownload?: (song: Song) => void;
}

interface CircularDownloadButtonProps {
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  onClick?: () => void;
  title?: string;
  size?: number;
}

const CircularDownloadButton = memo(function CircularDownloadButton({
  isDownloaded,
  isDownloading,
  progress,
  onClick,
  title,
  size = 32,
}: CircularDownloadButtonProps) {
  const strokeWidth = size >= 30 ? 2.5 : 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Progress clamped between 10% and 99% while downloading, and 100% when complete
  const clampedProgress = Math.min(99, Math.max(10, progress));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDownloading}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 select-none group ${isDownloaded
        ? 'bg-teal-500/15 text-teal-400'
        : isDownloading
          ? 'bg-zinc-950 text-teal-300 shadow-md'
          : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-400 hover:text-white'
        }`}
      title={title}
      aria-label={title}
    >
      {/* SVG Circular Border Ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 pointer-events-none -rotate-90"
        style={{ transformOrigin: '50% 50%' }}
      >
        {/* Background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={
            isDownloaded
              ? 'rgba(45, 212, 191, 0.4)'
              : isDownloading
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(255, 255, 255, 0.16)'
          }
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress filling around circular border */}
        {isDownloading && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#2dd4bf"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-300 ease-out"
          />
        )}

        {/* Complete state check ring */}
        {isDownloaded && !isDownloading && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#2dd4bf"
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
      </svg>

      {/* Center Content: Percent 10%-99%, Checkmark when done, or Download arrow */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none">
        {isDownloading ? (
          <span className="text-[7.5px] sm:text-[8.5px] font-mono font-black text-teal-300 leading-none tracking-tighter">
            {clampedProgress}%
          </span>
        ) : isDownloaded ? (
          <Check size={size >= 30 ? 14 : 11} className="text-teal-400 stroke-[3]" />
        ) : (
          <Download size={size >= 30 ? 13 : 10} className="transition-transform group-hover:scale-110" />
        )}
      </div>
    </button>
  );
});

const SongGridCard = memo(function SongGridCard({
  song,
  songStatus,
  isFav,
  isAlreadyReserved,
  isDownloaded = false,
  isDownloading = false,
  downloadProgress = 0,
  onToggleFav,
  onReserve,
  onDownload,
}: SongCardProps) {
  const thumbnailUrl = song.thumbnail_url || (song.youtube_video_id ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg` : null);

  return (
    <div
      className="flex flex-col justify-between p-1.5 rounded-xl transition-all bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 shadow-sm relative group overflow-hidden"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '0 150px',
        borderColor:
          songStatus.status === 'success'
            ? 'rgba(45, 212, 191, 0.6)'
            : isAlreadyReserved
              ? 'rgba(45, 212, 191, 0.3)'
              : undefined,
      }}
    >
      {/* Top: Thumbnail with 16:9 Aspect Ratio + Floating Badges */}
      <div className="relative aspect-video w-full rounded-md sm:rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800/80 flex items-center justify-center">
        <OfflineSongThumbnail song={song} layoutMode="grid-3" />

        {/* Top-Right Floating Star / Favorite Toggle Button */}
        <div className="absolute top-1 right-1 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(song);
            }}
            className="w-4.5 h-4.5 rounded bg-black/70 backdrop-blur-md flex items-center justify-center text-zinc-400 hover:text-yellow-400 active:scale-90 transition-all border border-white/10 shadow-sm"
            title={isFav ? 'Remove favorite' : 'Add favorite'}
            aria-label={isFav ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
          >
            <Star
              size={10}
              className={isFav ? 'fill-yellow-400 text-yellow-400' : ''}
            />
          </button>
        </div>

        {/* Top-Left Queued Pill if in Queue */}
        {isAlreadyReserved && (
          <div className="absolute top-1 left-1 px-1 py-0.2 rounded bg-teal-500/90 text-black text-[7px] font-black flex items-center gap-0.5 shadow-sm">
            <CheckCircle size={7} className="stroke-[3]" />
            <span>QUEUED</span>
          </div>
        )}

        {/* Bottom-Left Song Code / Type Badge */}
        {song.code && song.code !== 'YT' ? (
          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/80 backdrop-blur-md text-[7px] font-mono font-bold text-teal-300 border border-teal-500/30">
            #{song.code}
          </div>
        ) : song.song_type ? (
          <div className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/80 backdrop-blur-md text-[7px] font-bold text-teal-300 border border-teal-500/30 uppercase truncate max-w-[50px]">
            {song.song_type}
          </div>
        ) : null}
      </div>

      {/* Middle: Title & Artist */}
      <div className="mt-1 min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <p className="font-bold text-white text-[10px] leading-tight line-clamp-1 truncate" title={song.title}>
            {song.title}
          </p>
          <p className="text-[9px] text-zinc-400 truncate mt-0.5" title={song.artist}>
            {song.artist}
          </p>
        </div>
      </div>

      {/* Status error notification if any */}
      {songStatus.status === 'error' && songStatus.message && (
        <p className="text-[8px] text-red-400 text-center mt-1 truncate">
          {songStatus.message}
        </p>
      )}

      {/* Bottom: Action Buttons (Reserve + Download to Phone) */}
      <div className="mt-1.5 flex items-center gap-1 shrink-0">
        <button
          id={`reserve-btn-${song.id}`}
          onClick={() => onReserve(song)}
          disabled={songStatus.status === 'reserving' || songStatus.status === 'success'}
          className={`flex-1 h-6.5 rounded-md sm:rounded-lg flex items-center justify-center gap-0.5 transition-all active:scale-95 text-[9px] font-black tracking-wide shadow-sm disabled:opacity-60 shrink-0 ${songStatus.status === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-teal-400 hover:bg-teal-300 text-black'
            }`}
          title="Reserve song"
          aria-label={`Reserve ${song.title}`}
        >
          {songStatus.status === 'reserving' ? (
            <>
              <Loader2 size={10} className="animate-spin text-black" />
              <span>...</span>
            </>
          ) : songStatus.status === 'success' ? (
            <>
              <CheckCircle size={10} className="text-green-400" />
              <span>ADDED</span>
            </>
          ) : (
            <>
              <Plus size={10} className="stroke-[3]" />
              <span>RESERVE</span>
            </>
          )}
        </button>

        {/* Circular Download Button with Border Progress */}
        <CircularDownloadButton
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          progress={downloadProgress}
          onClick={() => onDownload?.(song)}
          size={26}
          title={
            isDownloaded
              ? 'Saved on phone (Tap to re-download MP4)'
              : isDownloading
                ? `Downloading (${downloadProgress}%)...`
                : 'Save MP4 to device storage for offline play'
          }
        />
      </div>
    </div>
  );
});

const SongListCard = memo(function SongListCard({
  song,
  songStatus,
  isFav,
  isAlreadyReserved,
  isDownloaded = false,
  isDownloading = false,
  downloadProgress = 0,
  onToggleFav,
  onReserve,
  onDownload,
}: SongCardProps) {
  const thumbnailUrl = song.thumbnail_url || (song.youtube_video_id ? `https://img.youtube.com/vi/${song.youtube_video_id}/mqdefault.jpg` : null);

  return (
    <div
      className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all bg-zinc-900 border border-zinc-800"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '0 64px',
        borderColor:
          isAlreadyReserved || songStatus.status === 'success'
            ? 'rgba(45, 212, 191, 0.4)'
            : 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Star Favorite Button */}
      <button
        type="button"
        onClick={() => onToggleFav(song)}
        className="p-1 rounded-lg transition-all active:scale-90 hover:bg-zinc-800 shrink-0"
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFav ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
      >
        <Star
          size={16}
          className={isFav ? 'fill-yellow-400 text-yellow-400 drop-shadow' : 'text-zinc-500 hover:text-yellow-400'}
        />
      </button>

      {/* Video Thumbnail */}
      <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden bg-zinc-800 shrink-0 relative border border-zinc-800 flex items-center justify-center">
        <OfflineSongThumbnail song={song} layoutMode="list" />
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{song.title}</p>
        <p className="text-xs text-zinc-400 truncate mt-0.5">{song.artist}</p>

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 flex items-center gap-1 shrink-0">
            {renderSongTypeIcon(song.song_type)}
            <span>{song.song_type || 'Karaoke'}</span>
          </span>

          {song.code && song.code !== 'YT' && (
            <span className="text-xs text-zinc-400 font-mono">#{song.code}</span>
          )}

          {isAlreadyReserved && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 border border-teal-500/25 shrink-0 flex items-center gap-1">
              <CheckCircle size={10} className="text-teal-400" />
              <span>Queued</span>
            </span>
          )}

          {song.category && (song.category as string) !== 'YouTube' && (
            <span className="text-xs text-zinc-400">· {song.category}</span>
          )}
        </div>
      </div>

      {/* Status error notification */}
      {songStatus.status === 'error' && songStatus.message && (
        <div className="flex items-center gap-1">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300 max-w-24 truncate">
            {songStatus.message}
          </span>
        </div>
      )}

      {/* Action buttons (Download + Reserve) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Circular Download Button with Border Progress */}
        <CircularDownloadButton
          isDownloaded={isDownloaded}
          isDownloading={isDownloading}
          progress={downloadProgress}
          onClick={() => onDownload?.(song)}
          size={32}
          title={
            isDownloaded
              ? 'Saved on phone (Tap to re-download MP4)'
              : isDownloading
                ? `Downloading (${downloadProgress}%)...`
                : 'Save MP4 to device storage for offline play'
          }
        />

        <button
          id={`reserve-btn-${song.id}`}
          onClick={() => onReserve(song)}
          disabled={songStatus.status === 'reserving' || songStatus.status === 'success'}
          className={`h-8.5 px-3 rounded-xl flex items-center gap-1 transition-all active:scale-95 text-[11px] font-black tracking-wide shadow-sm ${songStatus.status === 'success'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-teal-400 hover:bg-teal-300 text-black disabled:opacity-75'
            }`}
          aria-label={`Reserve ${song.title}`}
        >
          {songStatus.status === 'reserving' ? (
            <>
              <Loader2 size={13} className="animate-spin text-black" />
              <span>...</span>
            </>
          ) : songStatus.status === 'success' ? (
            <>
              <CheckCircle size={13} className="text-green-400" />
              <span>ADDED</span>
            </>
          ) : (
            <>
              <Plus size={14} className="stroke-[3]" />
              <span>RESERVE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});

export const SongSearch = memo(function SongSearch({
  roomCode,
  sessionId,
  guestName,
  onReserved,
  onReserveFailed,
  reservedSongIds,
  isSoloTVMode = false,
}: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [catalog, setCatalog] = useState<SongWithReserving[]>([]);
  const [searchResults, setSearchResults] = useState<SongWithReserving[]>([]);
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('grid');

  // Load saved layout preference or default to 2-column grid
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('okekaraoke_song_layout');
      if (saved === 'list' || saved === 'grid') {
        setLayoutMode(saved);
      } else {
        setLayoutMode('grid');
      }
    }
  }, []);

  const handleSetLayoutMode = (mode: 'list' | 'grid') => {
    setLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('okekaraoke_song_layout', mode);
    }
  };
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [reserveStatus, setReserveStatus] = useState<Record<string, { status: 'idle' | 'reserving' | 'success' | 'error'; message?: string }>>({});
  const [favTrigger, setFavTrigger] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline detection state
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [downloadedSongsList, setDownloadedSongsList] = useState<Song[]>([]);

  // Downloaded song IDs cache & live progress tracking
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloadingMap, setDownloadingMap] = useState<Record<string, number>>({});
  const [downloadToast, setDownloadToast] = useState<{ title: string; message: string; success: boolean } | null>(null);

  // Sync downloads live across components from IndexedDB
  const refreshDownloads = useCallback(async () => {
    try {
      const downloaded = await getDownloadedSongs();
      const ids = new Set<string>();
      const list: Song[] = [];
      for (const item of downloaded) {
        if (item.id) ids.add(item.id);
        if (item.code && item.code !== 'YT') ids.add(item.code);
        if (item.youtube_video_id) ids.add(item.youtube_video_id);
        list.push({
          id: item.id,
          code: item.code || 'DOWNLOADED',
          title: item.title,
          artist: item.artist,
          youtube_video_id: item.youtube_video_id || '',
          thumbnail_url: item.thumbnail_url || '',
          duration_seconds: item.duration_seconds || 180,
          genre: 'Downloaded',
          play_count: 0,
        } as unknown as Song);
      }
      setDownloadedIds(ids);
      setDownloadedSongsList(list);
    } catch (err) {
      console.warn('Failed to load downloaded songs:', err);
    }
  }, []);

  useEffect(() => {
    refreshDownloads();
    window.addEventListener(DOWNLOADS_CHANGED_EVENT, refreshDownloads);
    return () => window.removeEventListener(DOWNLOADS_CHANGED_EVENT, refreshDownloads);
  }, [refreshDownloads]);

  const handleDownload = useCallback(async (song: Song) => {
    const key = song.id || song.youtube_video_id || song.code;
    if (!key) return;

    // If already downloaded, notify user that re-download will update the offline video file
    if (
      downloadedIds.has(key) ||
      (song.code && downloadedIds.has(song.code)) ||
      (song.youtube_video_id && downloadedIds.has(song.youtube_video_id))
    ) {
      setDownloadToast({
        title: 'Updating Video File... ⬇️',
        message: `Downloading latest full MP4 video for "${song.title}"...`,
        success: true,
      });
    }

    setDownloadingMap((prev) => ({ ...prev, [song.id]: 10 }));

    try {
      await downloadAndSaveSong(song, (progress) => {
        setDownloadingMap((prev) => ({ ...prev, [song.id]: progress }));
      });

      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });

      await refreshDownloads();

      setDownloadToast({
        title: 'Saved to Device! ⬇️',
        message: `"${song.title}" saved locally. Play anytime offline in Mine → Downloads tab!`,
        success: true,
      });
      setTimeout(() => setDownloadToast(null), 4000);
    } catch (err: any) {
      setDownloadingMap((prev) => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
      setDownloadToast({
        title: 'Download Failed',
        message: err?.message || 'Could not save song to local storage. Check available storage.',
        success: false,
      });
      // Keep error toast open (no auto-hide) so the full details can be read/copied
    }
  }, [downloadedIds, refreshDownloads]);

  // Sync favorites live across components
  useEffect(() => {
    const handleFavUpdate = () => setFavTrigger((prev) => prev + 1);
    window.addEventListener('okekaraoke_favorites_updated', handleFavUpdate);
    return () => window.removeEventListener('okekaraoke_favorites_updated', handleFavUpdate);
  }, []);


  const [catalogPage, setCatalogPage] = useState(1);
  const [hasMoreCatalog, setHasMoreCatalog] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch initial database catalog on mount or load additional pages
  const fetchCatalog = useCallback(async (pageToLoad = 1) => {
    const isClientOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isClientOffline) {
      setIsOffline(true);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (pageToLoad === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await fetch(`/api/songs/search?limit=50&page=${pageToLoad}`);
      const json = await response.json().catch(() => null);
      if (json?.success && Array.isArray(json.data?.songs)) {
        setIsOffline(false);
        if (pageToLoad === 1) {
          setCatalog(json.data.songs);
        } else {
          setCatalog((prev) => {
            const seen = new Set(prev.map((s) => s.id));
            const newSongs = json.data.songs.filter((s: Song) => !seen.has(s.id));
            return [...prev, ...newSongs];
          });
        }
        setCatalogPage(pageToLoad);
        if (json.data.songs.length < 50) {
          setHasMoreCatalog(false);
        }
      } else {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setIsOffline(true);
        }
        setHasMoreCatalog(false);
      }
    } catch (err) {
      console.warn('Failed to load songs catalog:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleLoadMore = () => {
    if (loadingMore || !hasMoreCatalog) return;
    fetchCatalog(catalogPage + 1);
  };

  useEffect(() => {
    fetchCatalog(1);
  }, [fetchCatalog]);

  // Online / offline event listeners to auto-refresh catalog in real-time
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setLoading(true);
      fetchCatalog(1);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setLoading(false);
      refreshDownloads();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Real-time heartbeat: immediately catches network changes in Airplane Mode / WebViews
    const timer = setInterval(() => {
      if (typeof navigator !== 'undefined') {
        const currentlyOffline = !navigator.onLine;
        setIsOffline((prev) => {
          if (prev !== currentlyOffline) {
            if (currentlyOffline) {
              setLoading(false);
              refreshDownloads();
            } else {
              setLoading(true);
              fetchCatalog(1);
            }
            return currentlyOffline;
          }
          return prev;
        });
      }
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, [fetchCatalog, refreshDownloads]);

  // Perform search when user types
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const isClientOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isClientOffline) {
      setIsOffline(true);
      setLoading(false);
      setSearched(true);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '30' });
      const response = await fetch(`/api/songs/search?${params.toString()}`);
      const json = await response.json().catch(() => null);

      if (json?.success && Array.isArray(json.data?.songs)) {
        setIsOffline(false);
        setSearchResults(json.data.songs);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value);
    }, 350);
  };

  const handleToggleFav = useCallback((song: Song) => {
    toggleFavoriteSong(song);
    setFavTrigger((prev) => prev + 1);
  }, []);

  const handleReserve = useCallback(async (song: Song) => {
    if (!sessionId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Instant optimistic visual feedback on the button in 0ms
    setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'success' } }));

    // Instant 0ms optimistic addition to queue & Mine tab
    onReserved(song, null, tempId);

    // Auto-clear success feedback after 1.5s so button automatically reverts to RESERVE
    setTimeout(() => {
      setReserveStatus((prev) => {
        if (!prev[song.id] || prev[song.id].status !== 'success') return prev;
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }, 1500);

    const isDownloadedSong = Boolean(
      downloadedIds.has(song.id) ||
      (song.code && downloadedIds.has(song.code)) ||
      (song.youtube_video_id && downloadedIds.has(song.youtube_video_id))
    );

    // If offline (Airplane Mode / Wi-Fi off), play downloaded song locally without network call
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (isDownloadedSong) {
        onReserved(song, null, `offline_${song.id}`);
        return;
      } else {
        setReserveStatus((prev) => ({
          ...prev,
          [song.id]: { status: 'error', message: 'Offline.' },
        }));
        setTimeout(() => {
          setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'idle' } }));
        }, 3000);
        return;
      }
    }

    try {
      const response = await fetch('/api/queue/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          song_code: song.code,
          youtube_video_id: song.youtube_video_id,
          title: song.title,
          artist: song.artist,
          thumbnail_url: song.thumbnail_url,
          guest_session_id: sessionId,
          guest_name: guestName || null,
        }),
      });

      const json = await response.json();

      if (json.success) {
        onReserved(song, json.data, tempId);
      } else {
        onReserveFailed?.(tempId);
        setReserveStatus((prev) => ({
          ...prev,
          [song.id]: { status: 'error', message: json.error?.message ?? 'Failed to reserve' },
        }));
        setTimeout(() => {
          setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'idle' } }));
        }, 3000);
      }
    } catch {
      onReserveFailed?.(tempId);
      setReserveStatus((prev) => ({
        ...prev,
        [song.id]: { status: 'error', message: 'Network error. Try again.' },
      }));
      setTimeout(() => {
        setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'idle' } }));
      }, 3000);
    }
  }, [sessionId, roomCode, guestName, onReserved, onReserveFailed]);

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Microphone Voice Search Handler (Android Chrome compatible)
  const startVoiceSearch = useCallback(() => {
    setMicError(null);
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError('Voice search is not supported on this browser.');
      setTimeout(() => setMicError(null), 3500);
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { }
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false; // Disable interim results on mobile/Android Chrome to prevent sudden speech aborts
      recognition.lang = window.navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        const trimmed = transcript.trim();
        if (trimmed) {
          setQuery(trimmed);
          search(trimmed);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicError('Microphone permission denied. Please allow mic in browser settings.');
        } else if (event.error === 'no-speech') {
          setMicError('No speech detected. Tap mic & speak clearly.');
        } else if (event.error === 'audio-capture') {
          setMicError('Microphone hardware in use or unavailable.');
        } else if (event.error === 'aborted') {
          // Ignored on user cancel
        } else {
          setMicError('Voice search error. Tap mic and try again.');
        }
        setTimeout(() => setMicError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      // Directly start SpeechRecognition. DO NOT call getUserMedia beforehand
      // because getUserMedia locks the mic hardware stream on Android Chrome, breaking WebSpeech!
      recognition.start();
    } catch (e) {
      console.error('Speech recognition exception:', e);
      setIsListening(false);
    }
  }, [search]);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
    }
    setIsListening(false);
  }, []);

  const toggleVoiceSearch = () => {
    if (isListening) {
      stopVoiceSearch();
    } else {
      startVoiceSearch();
    }
  };

  // Cache favorite song IDs in-memory for instant O(1) checks (zero localStorage reads during render!)
  const favoriteIds = useMemo(() => {
    const favs = getFavoriteSongs();
    const set = new Set<string>();
    for (const f of favs) {
      if (f.id) set.add(f.id);
      if (f.code && f.code !== 'YT') set.add(f.code);
    }
    return set;
  }, [favTrigger]);

  // Determine list of displayed songs with useMemo to avoid re-filtering on every tick
  const filteredList = useMemo(() => {
    // ── 1. REALTIME OFFLINE MODE: AUTOMATICALLY SHOW ONLY DOWNLOADED SONGS ──────────
    if (isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (!query.trim()) {
        return downloadedSongsList as SongWithReserving[];
      }
      const q = query.toLowerCase().trim();
      return downloadedSongsList.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q))
      ) as SongWithReserving[];
    }

    // ── 2. ONLINE MODE: SHOW CATALOG OR SEARCH RESULTS ────────────────────
    let baseList = searched ? searchResults : catalog;
    if (activeFilter === 'all') return baseList;
    const filterKey = activeFilter.toLowerCase();
    return baseList.filter((song) => {
      const cat = (song.category || '').toLowerCase();
      const type = (song.song_type || '').toLowerCase();
      return cat.includes(filterKey) || type.includes(filterKey);
    });
  }, [searched, searchResults, catalog, activeFilter, isOffline, downloadedSongsList, query]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Input & Category Filter Bar */}
      <div className={`sticky top-0 transition-all ${isSoloTVMode ? 'p-2 space-y-2' : 'p-4 space-y-3'}`} style={{ background: 'var(--color-bg)', zIndex: 10 }}>
        <div className="relative flex items-center">
          <Search size={isSoloTVMode ? 15 : 18} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${isListening ? 'text-teal-400' : 'text-slate-500'}`} />
          <input
            id="song-search-input"
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={
              isListening
                ? "Listening... Speak title or artist"
                : isOffline
                  ? `Search ${downloadedSongsList.length} downloaded songs...`
                  : "Search 100K+ songs, artists, YouTube..."
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`w-full pl-9 pr-16 rounded-xl text-white placeholder-slate-500 transition-all ${isSoloTVMode ? 'py-2 text-xs' : 'py-3 text-sm'
              } ${isListening ? 'ring-2 ring-teal-400/80 bg-teal-950/20' : ''}`}
            style={{
              background: isListening ? 'rgba(20, 184, 166, 0.08)' : 'var(--color-surface-2)',
              border: isListening ? '1px solid rgba(45, 212, 191, 0.5)' : '1px solid var(--color-border)',
            }}
            onFocus={(e) => {
              if (!isListening) e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
            }}
            onBlur={(e) => {
              if (!isListening) e.target.style.borderColor = 'var(--color-border)';
            }}
          />

          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setSearchResults([]);
                  setSearched(false);
                }}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}

            {/* Voice Search Microphone Button */}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${isListening
                ? 'bg-red-500 text-white animate-pulse shadow-md scale-105'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              aria-label={isListening ? 'Stop voice search' : 'Voice search with microphone'}
              title={isListening ? 'Stop voice search' : 'Voice search with microphone'}
            >
              <Mic size={14} className={isListening ? 'animate-bounce text-white' : ''} />
            </button>
          </div>
        </div>

        {/* Mic Error Banner */}
        {micError && (
          <div className="p-2 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <span>{micError}</span>
          </div>
        )}

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORY_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            const IconComponent = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-full font-bold shrink-0 flex items-center gap-1 transition-all ${isSoloTVMode ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
                  } ${isActive
                    ? 'bg-white text-black font-extrabold shadow'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/60'
                  }`}
              >
                <IconComponent size={isSoloTVMode ? 11 : 13} className={isActive ? 'text-black' : 'text-zinc-400'} />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog & Results Section */}
      <div
        className={`flex-1 overflow-y-auto pb-4 ${isSoloTVMode ? 'px-2.5' : 'px-4'}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        {/* Header label & View Mode Toggle */}
        <div className="flex items-center justify-between py-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-extrabold text-zinc-300 uppercase tracking-wider">
              {isOffline
                ? `Downloaded Songs (${filteredList.length})`
                : searched
                  ? `Results (${filteredList.length})`
                  : activeFilter !== 'all'
                    ? `${activeFilter.toUpperCase()} Hits`
                    : 'Trending Hits'}
            </span>
            {!searched && activeFilter === 'all' && !isOffline && (
              <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 shrink-0">
                100K+ Karaoke Songs
              </span>
            )}
            {isOffline && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                Offline
              </span>
            )}
          </div>

          {/* Refresh & Grid / List Layout Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                  setIsOffline(true);
                  setDownloadToast({
                    title: 'Offline Mode',
                    message: 'Cannot refresh online catalog without internet connection.',
                    success: false,
                  });
                  setTimeout(() => setDownloadToast(null), 3000);
                  return;
                }
                setIsOffline(false);
                fetchCatalog(1);
              }}
              disabled={loading && !isOffline}
              className="p-1 px-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Songs Catalog"
            >
              <RefreshCw size={11} className={loading && !isOffline ? 'animate-spin text-teal-400' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => handleSetLayoutMode('list')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${layoutMode === 'list' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                title="1-Column Full Width List"
              >
                <List size={12} />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => handleSetLayoutMode('grid')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${layoutMode === 'grid' ? 'bg-zinc-800 text-teal-400 shadow' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                title="3-Column Grid"
              >
                <LayoutGrid size={12} />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Spinner - ONLY shown when Online and loading */}
        {!isOffline && loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
            <Loader2 size={16} className="animate-spin text-teal-400" />
            <span className="text-xs">Loading songs...</span>
          </div>
        )}

        {/* Empty State when Offline with 0 downloaded songs */}
        {!loading && filteredList.length === 0 && isOffline && (
          <div className="text-center py-10 px-4">
            <WifiOff size={36} className="text-amber-500/50 mx-auto mb-2" />
            <p className="text-zinc-300 font-bold text-xs">OFFLINE — NO DOWNLOADED SONGS YET</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
              You are currently offline. Connect to Wi-Fi or mobile data to search and download karaoke songs for offline play.
            </p>
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                  setDownloadToast({
                    title: 'Still Offline',
                    message: 'Connect to Wi-Fi or mobile data first.',
                    success: false,
                  });
                  setTimeout(() => setDownloadToast(null), 3000);
                  return;
                }
                setIsOffline(false);
                fetchCatalog(1);
              }}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <RefreshCw size={12} />
              <span>Refresh Songs</span>
            </button>
          </div>
        )}

        {/* Empty State when Online */}
        {!loading && filteredList.length === 0 && !isOffline && (
          <div className="text-center py-10 px-4">
            <Music2 size={36} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-400 font-medium text-xs">NO KARAOKE SONGS FOUND</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {searched
                ? 'Try searching with different keywords'
                : 'No songs match this filter'}
            </p>
            <button
              onClick={() => fetchCatalog(1)}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-zinc-700 font-semibold text-xs inline-flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <RefreshCw size={12} />
              <span>Refresh Songs</span>
            </button>
          </div>
        )}

        {!loading && filteredList.length > 0 && (
          layoutMode === 'grid' ? (
            /* 3-Column Compact Grid Layout */
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {filteredList.map((song) => {
                const songStatus = reserveStatus[song.id] ?? { status: 'idle' };
                const isFav = Boolean((song.id && favoriteIds.has(song.id)) || (song.code && song.code !== 'YT' && favoriteIds.has(song.code)));
                const isAlreadyReserved =
                  Boolean(reservedSongIds?.has(song.id)) ||
                  Boolean(song.youtube_video_id && reservedSongIds?.has(song.youtube_video_id)) ||
                  Boolean(song.code && reservedSongIds?.has(song.code));

                const isDownloaded =
                  Boolean(song.id && downloadedIds.has(song.id)) ||
                  Boolean(song.code && song.code !== 'YT' && downloadedIds.has(song.code)) ||
                  Boolean(song.youtube_video_id && downloadedIds.has(song.youtube_video_id));

                const isDownloading =
                  typeof downloadingMap[song.id] === 'number' ||
                  Boolean(song.youtube_video_id && typeof downloadingMap[song.youtube_video_id] === 'number');

                const downloadProgress =
                  downloadingMap[song.id] ??
                  (song.youtube_video_id ? downloadingMap[song.youtube_video_id] : 0) ??
                  0;

                return (
                  <SongGridCard
                    key={song.id}
                    song={song}
                    songStatus={songStatus}
                    isFav={isFav}
                    isAlreadyReserved={isAlreadyReserved}
                    isDownloaded={isDownloaded}
                    isDownloading={isDownloading}
                    downloadProgress={downloadProgress}
                    onToggleFav={handleToggleFav}
                    onReserve={handleReserve}
                    onDownload={handleDownload}
                  />
                );
              })}
            </div>
          ) : (
            /* 1-Column Full Width List Layout */
            <div className="space-y-2">
              {filteredList.map((song) => {
                const songStatus = reserveStatus[song.id] ?? { status: 'idle' };
                const isFav = Boolean((song.id && favoriteIds.has(song.id)) || (song.code && song.code !== 'YT' && favoriteIds.has(song.code)));
                const isAlreadyReserved =
                  Boolean(reservedSongIds?.has(song.id)) ||
                  Boolean(song.youtube_video_id && reservedSongIds?.has(song.youtube_video_id)) ||
                  Boolean(song.code && reservedSongIds?.has(song.code));

                const isDownloaded =
                  Boolean(song.id && downloadedIds.has(song.id)) ||
                  Boolean(song.code && song.code !== 'YT' && downloadedIds.has(song.code)) ||
                  Boolean(song.youtube_video_id && downloadedIds.has(song.youtube_video_id));

                const isDownloading =
                  typeof downloadingMap[song.id] === 'number' ||
                  Boolean(song.youtube_video_id && typeof downloadingMap[song.youtube_video_id] === 'number');

                const downloadProgress =
                  downloadingMap[song.id] ??
                  (song.youtube_video_id ? downloadingMap[song.youtube_video_id] : 0) ??
                  0;

                return (
                  <SongListCard
                    key={song.id}
                    song={song}
                    songStatus={songStatus}
                    isFav={isFav}
                    isAlreadyReserved={isAlreadyReserved}
                    isDownloaded={isDownloaded}
                    isDownloading={isDownloading}
                    downloadProgress={downloadProgress}
                    onToggleFav={handleToggleFav}
                    onReserve={handleReserve}
                    onDownload={handleDownload}
                  />
                );
              })}
            </div>
          )
        )}

        {/* Floating Download Notification Toast */}
        {downloadToast && (
          <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto flex items-center gap-3 p-3 rounded-2xl bg-zinc-950/95 border border-teal-500/40 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${downloadToast.success ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
              {downloadToast.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight">{downloadToast.title}</p>
              <p className={`text-[11px] text-zinc-300 mt-0.5 ${downloadToast.success ? 'truncate' : 'whitespace-pre-wrap break-words max-h-48 overflow-y-auto select-text'}`}>{downloadToast.message}</p>
            </div>
            <button
              onClick={() => setDownloadToast(null)}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Load More & Unlimited Songs Reassurance Banner */}
        {!searched && !loading && filteredList.length > 0 && (
          <div className="mt-4 pb-4 flex flex-col items-center gap-2.5">
            {hasMoreCatalog ? (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-zinc-800/90 hover:bg-zinc-700/90 active:scale-[0.98] border border-zinc-700/60 text-zinc-200 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-teal-400" />
                    <span>Loading more songs...</span>
                  </>
                ) : (
                  <>

                    <span>Load More Songs</span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-[11px] text-zinc-500 font-medium text-center">
                Showing {catalog.length} curated hits · Search 100K+ songs on YouTube
              </p>
            )}

            {/* Reassurance Banner */}
            <div className="w-full p-2.5 rounded-xl bg-gradient-to-r from-teal-950/30 via-zinc-900 to-indigo-950/30 border border-teal-500/20 text-center">
              <p className="text-[11px] text-teal-300 font-semibold flex items-center justify-center gap-1.5">

                <span>Can&apos;t find your song?</span>
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Type any title, artist, or YouTube song in the search bar above to sing it!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

