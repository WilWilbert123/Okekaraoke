'use client';

// ============================================================
// OKEKARAOKE — My Reservations & Favorites Component
// Allows each user to view/manage queued songs and favorite songs
// ============================================================

import { useState, useEffect } from 'react';
import { Star, Loader2, Trash2, Square, Play, CheckCircle, Plus, Music2 } from 'lucide-react';
import type { EnrichedQueueItem, Song } from '@/lib/types';
import { getFavoriteSongs, toggleFavoriteSong } from '@/lib/utils/favorites';

interface MyReservationsProps {
  reservations: EnrichedQueueItem[];
  sessionId: string;
  roomCode: string;
  guestName?: string;
  onCancelled: () => void;
  allowCancel: boolean;
}

const statusColors = {
  queued: { bg: 'rgba(45, 212, 191, 0.08)', border: 'rgba(45, 212, 191, 0.2)', text: '#2dd4bf', label: 'QUEUED' },
  playing: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', label: 'PLAYING' },
  completed: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)', text: '#64748b', label: 'DONE' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'CANCELLED' },
  skipped: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', label: 'SKIPPED' },
};

export function MyReservations({
  reservations,
  sessionId,
  roomCode,
  guestName,
  onCancelled,
  allowCancel,
}: MyReservationsProps) {
  const [activeTab, setActiveTab] = useState<'reservations' | 'favorites'>('reservations');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [reservingFavId, setReservingFavId] = useState<string | null>(null);

  // Sync favorites on mount & storage update
  useEffect(() => {
    setFavorites(getFavoriteSongs());
    const handleFavUpdate = () => setFavorites(getFavoriteSongs());
    window.addEventListener('okekaraoke_favorites_updated', handleFavUpdate);
    return () => window.removeEventListener('okekaraoke_favorites_updated', handleFavUpdate);
  }, []);

  // Cancel own queued song
  const handleCancel = async (queueItemId: string) => {
    if (!sessionId) return;
    setCancellingId(queueItemId);

    try {
      const response = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queue_item_id: queueItemId,
          guest_session_id: sessionId,
        }),
      });

      const json = await response.json();
      if (json.success) {
        onCancelled();
      }
    } catch {
      // Error handled silently
    } finally {
      setCancellingId(null);
    }
  };

  // Stop own currently playing song and advance to next song
  const handleStopMySong = async (queueItemId: string) => {
    if (!sessionId) return;
    setStoppingId(queueItemId);

    try {
      const response = await fetch('/api/queue/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          session_id: sessionId,
          queue_item_id: queueItemId,
        }),
      });

      const json = await response.json();
      if (json.success) {
        onCancelled();
      }
    } catch {
      // Error handled silently
    } finally {
      setStoppingId(null);
    }
  };

  // Reserve favorite song directly from Favorites tab
  const handleReserveFavorite = async (song: Song) => {
    if (!sessionId) return;
    setReservingFavId(song.id || song.code);

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
        onCancelled();
      }
    } catch {
      // Error handled silently
    } finally {
      setReservingFavId(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
        <button
          onClick={() => setActiveTab('reservations')}
          className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'reservations'
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span className="truncate">MY RESERVATIONS</span>
          <span
            className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
              activeTab === 'reservations'
                ? 'bg-teal-500/20 text-teal-700'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {reservations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'favorites'
              ? 'bg-white text-black font-extrabold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Star
            size={12}
            className={`shrink-0 ${activeTab === 'favorites' ? 'fill-yellow-500 text-yellow-500' : 'text-yellow-500'}`}
          />
          <span className="truncate">FAVORITES</span>
          <span
            className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold shrink-0 ${
              activeTab === 'favorites'
                ? 'bg-yellow-500/20 text-yellow-700'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {favorites.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MY RESERVATIONS */}
      {activeTab === 'reservations' && (
        <div className="space-y-3">
          {reservations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Music2 size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO RESERVATIONS YET</p>
              <p className="text-xs text-zinc-500 mt-1">
                Search for songs or pick from your favorites to reserve
              </p>
            </div>
          ) : (
            reservations.map((item, index) => {
              const statusStyle = statusColors[item.status] ?? statusColors.queued;
              const isCancelling = cancellingId === item.queue_item_id;
              const isStopping = stoppingId === item.queue_item_id;
              const canCancel = allowCancel && item.status === 'queued';
              const isPlaying = item.status === 'playing';

              const itemThumb = item.song.thumbnail_url || (item.song.youtube_video_id ? `https://img.youtube.com/vi/${item.song.youtube_video_id}/mqdefault.jpg` : null);

              return (
                <div
                  key={item.queue_item_id}
                  className="flex items-center gap-2.5 p-3 rounded-xl transition-all"
                  style={{
                    background: statusStyle.bg,
                    border: `1px solid ${statusStyle.border}`,
                  }}
                >
                  {/* Position/status icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: statusStyle.bg }}
                  >
                    {isPlaying ? (
                      <Play size={14} style={{ fill: statusStyle.text, color: statusStyle.text }} />
                    ) : item.status === 'completed' ? (
                      <CheckCircle size={14} style={{ color: statusStyle.text }} />
                    ) : (
                      <span className="font-black text-xs" style={{ color: statusStyle.text }}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden bg-black shrink-0 relative border border-zinc-800 flex items-center justify-center">
                    {itemThumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={itemThumb}
                        alt={item.song.title}
                        className="w-full h-full object-cover scale-[1.18]"
                        loading="lazy"
                      />
                    ) : (
                      <Music2 size={18} className="text-zinc-600" />
                    )}
                  </div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{item.song.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{item.song.artist}</p>
                  </div>

                  {/* Actions & status badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold" style={{ color: statusStyle.text }}>
                      {statusStyle.label}
                    </span>

                    {/* Stop button for playing song (Icon only) */}
                    {isPlaying && (
                      <button
                        id={`stop-btn-${item.queue_item_id}`}
                        onClick={() => handleStopMySong(item.queue_item_id)}
                        disabled={isStopping}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shrink-0"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                        }}
                        title="Stop your song on TV"
                        aria-label={`Stop playing ${item.song.title}`}
                      >
                        {isStopping ? (
                          <Loader2 size={13} className="animate-spin text-red-400" />
                        ) : (
                          <Square size={12} className="fill-red-500 text-red-500" />
                        )}
                      </button>
                    )}

                    {/* Delete button for queued song */}
                    {canCancel && (
                      <button
                        id={`cancel-btn-${item.queue_item_id}`}
                        onClick={() => handleCancel(item.queue_item_id)}
                        disabled={isCancelling}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors active:scale-95 disabled:opacity-50"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                        title="Delete reservation"
                        aria-label={`Delete reservation for ${item.song.title}`}
                      >
                        {isCancelling ? (
                          <Loader2 size={14} className="text-red-400 animate-spin" />
                        ) : (
                          <Trash2 size={14} className="text-red-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: FAVORITES */}
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {favorites.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Star size={40} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold text-sm">NO FAVORITES YET</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto">
                Tap the star icon on any song in the Search tab to save it here for quick reservations anytime!
              </p>
            </div>
          ) : (
            favorites.map((song) => {
              const songKey = song.id || song.code;
              const isReserving = reservingFavId === songKey;

              return (
                <div
                  key={songKey}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all bg-zinc-900 border border-zinc-800"
                >
                  {/* Star Toggle Button */}
                  <button
                    onClick={() => {
                      toggleFavoriteSong(song);
                      setFavorites(getFavoriteSongs());
                    }}
                    className="p-1.5 rounded-lg transition-all active:scale-90 hover:bg-zinc-800 shrink-0"
                    title="Remove from favorites"
                    aria-label={`Remove ${song.title} from favorites`}
                  >
                    <Star size={18} className="fill-yellow-400 text-yellow-400 drop-shadow" />
                  </button>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{song.title}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{song.artist}</p>

                    {song.song_type && (
                      <span className="inline-block text-[10px] font-bold text-teal-400 mt-1 uppercase">
                        {song.song_type}
                      </span>
                    )}
                  </div>

                  {/* Reserve Favorite Song Button */}
                  <button
                    id={`reserve-fav-btn-${songKey}`}
                    onClick={() => handleReserveFavorite(song)}
                    disabled={isReserving}
                    className="shrink-0 h-8.5 px-3 rounded-xl flex items-center gap-1 bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-black transition-all active:scale-95 shadow-sm disabled:opacity-50"
                    aria-label={`Reserve ${song.title}`}
                  >
                    {isReserving ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-black" />
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} className="stroke-[3]" />
                        <span>RESERVE</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

