'use client';

// ============================================================
// OKEKARAOKE — Song Search Component
// Search songs by title, artist, or keywords
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Search, Music2, CheckCircle, AlertCircle, Loader2, Plus, X } from 'lucide-react';
import type { Song } from '@/lib/types';

interface SongSearchProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
  onReserved: () => void;
}

interface SongWithReserving extends Song {
  _reserving?: boolean;
  _reserved?: boolean;
}

export function SongSearch({ roomCode, sessionId, guestName, onReserved }: SongSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongWithReserving[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [reserveStatus, setReserveStatus] = useState<Record<string, { status: 'idle' | 'reserving' | 'success' | 'error'; message?: string }>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '20' });
      const response = await fetch(`/api/songs/search?${params.toString()}`);
      const json = await response.json();

      if (json.success) {
        setResults(json.data.songs ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(value);
    }, 400);
  };

  const handleReserve = async (song: Song) => {
    if (!sessionId) return;

    setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'reserving' } }));

    try {
      const response = await fetch('/api/queue/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          song_code: song.code,
          guest_session_id: sessionId,
          guest_name: guestName || null,
        }),
      });

      const json = await response.json();

      if (json.success) {
        setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'success' } }));
        onReserved();
        // Reset after 3s
        setTimeout(() => {
          setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'idle' } }));
        }, 3000);
      } else {
        setReserveStatus((prev) => ({
          ...prev,
          [song.id]: { status: 'error', message: json.error?.message ?? 'Failed to reserve' },
        }));
        setTimeout(() => {
          setReserveStatus((prev) => ({ ...prev, [song.id]: { status: 'idle' } }));
        }, 3000);
      }
    } catch {
      setReserveStatus((prev) => ({
        ...prev,
        [song.id]: { status: 'error', message: 'Network error. Try again.' },
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-4 sticky top-0" style={{ background: 'var(--color-bg)', zIndex: 10 }}>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="song-search-input"
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search songs, artists..."
            className="w-full pl-10 pr-10 py-3 rounded-xl text-white placeholder-slate-600 transition-all"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Searching songs...</span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 px-4">
            <Music2 size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">NO SONGS FOUND</p>
            <p className="text-sm text-slate-600 mt-1">Try different keywords or check the song code</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-12 px-4">
            <Search size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600">Type to search the song catalog</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="px-4 pb-4 space-y-2">
            {results.map((song) => {
              const songStatus = reserveStatus[song.id] ?? { status: 'idle' };
              return (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{
                    background: songStatus.status === 'success'
                      ? 'rgba(34, 197, 94, 0.06)'
                      : 'var(--color-surface)',
                    border: `1px solid ${songStatus.status === 'success'
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'var(--color-border-subtle)'}`,
                  }}
                >
                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{song.title}</p>
                    <p className="text-xs text-slate-500 truncate">{song.artist}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-700 font-mono">#{song.code}</span>
                      {song.category && (
                        <span className="text-xs text-slate-700">{song.category}</span>
                      )}
                    </div>
                  </div>

                  {/* Error message */}
                  {songStatus.status === 'error' && songStatus.message && (
                    <div className="flex items-center gap-1">
                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                      <span className="text-xs text-red-300 max-w-24 truncate">{songStatus.message}</span>
                    </div>
                  )}

                  {/* Reserve button */}
                  <button
                    id={`reserve-btn-${song.id}`}
                    onClick={() => handleReserve(song)}
                    disabled={songStatus.status === 'reserving' || songStatus.status === 'success'}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: songStatus.status === 'success'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(99, 102, 241, 0.15)',
                      border: `1px solid ${songStatus.status === 'success'
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(99, 102, 241, 0.3)'}`,
                    }}
                    aria-label={`Reserve ${song.title}`}
                  >
                    {songStatus.status === 'reserving' ? (
                      <Loader2 size={14} className="text-indigo-400 animate-spin" />
                    ) : songStatus.status === 'success' ? (
                      <CheckCircle size={14} className="text-green-400" />
                    ) : (
                      <Plus size={14} className="text-indigo-400" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
