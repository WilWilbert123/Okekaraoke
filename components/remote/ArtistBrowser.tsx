'use client';

// ============================================================
// OKEKARAOKE — Artist Browser Component
// A-Z artist list with search + song drill-down + smooth fade
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Music2, ChevronRight, ChevronLeft, Loader2, Plus, CheckCircle, AlertCircle, Users } from 'lucide-react';
import type { Song } from '@/lib/types';

interface ArtistBrowserProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
  onReserved: () => void;
}

interface Artist {
  name: string;
  count: number;
}

interface SongWithStatus extends Song {
  _status?: 'idle' | 'reserving' | 'success' | 'error';
  _message?: string;
}

// Fade-in wrapper — key changes trigger re-mount + animation
function FadeIn({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <div key={id} style={{ animation: 'fadeSlideIn 0.22s ease both' }}>
      {children}
    </div>
  );
}

export function ArtistBrowser({ roomCode, sessionId, guestName, onReserved }: ArtistBrowserProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [filteredArtists, setFilteredArtists] = useState<Artist[]>([]);
  const [artistFilter, setArtistFilter] = useState('');
  const [loadingArtists, setLoadingArtists] = useState(true);

  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<SongWithStatus[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);

  const [activeLetters, setActiveLetters] = useState<Set<string>>(new Set());
  const [jumpLetter, setJumpLetter] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Load artists ──────────────────────────────────────────
  const loadArtists = useCallback(async () => {
    setLoadingArtists(true);
    try {
      const res = await fetch('/api/songs/artists');
      const json = await res.json();
      if (json.success) {
        const list: Artist[] = json.data.artists ?? [];
        setArtists(list);
        setFilteredArtists(list);
        setActiveLetters(new Set(list.map((a) => a.name[0]?.toUpperCase() ?? '#')));
      }
    } catch {
      // silent
    } finally {
      setLoadingArtists(false);
    }
  }, []);

  useEffect(() => { loadArtists(); }, [loadArtists]);

  // ── Filter artists ────────────────────────────────────────
  useEffect(() => {
    const q = artistFilter.toLowerCase();
    const filtered = q
      ? artists.filter((a) => a.name.toLowerCase().includes(q))
      : artists;
    setFilteredArtists(filtered);
  }, [artistFilter, artists]);

  // ── Load songs for selected artist ───────────────────────
  const loadSongs = useCallback(async (artist: Artist) => {
    setSelectedArtist(artist);
    setLoadingSongs(true);
    setSongs([]);
    try {
      const res = await fetch(`/api/songs/artists?artist=${encodeURIComponent(artist.name)}`);
      const json = await res.json();
      if (json.success) {
        setSongs((json.data.songs ?? []).map((s: Song) => ({ ...s, _status: 'idle' })));
      }
    } catch {
      // silent
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  // ── Reserve song ──────────────────────────────────────────
  const handleReserve = async (song: SongWithStatus) => {
    setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'reserving' } : s));
    try {
      const res = await fetch('/api/queue/reserve', {
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
      const json = await res.json();
      if (json.success) {
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'success' } : s));
        onReserved();
        setTimeout(() => {
          setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'idle' } : s));
        }, 3000);
      } else {
        setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'error', _message: json.error?.message ?? 'Failed' } : s));
        setTimeout(() => {
          setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'idle' } : s));
        }, 3000);
      }
    } catch {
      setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, _status: 'error', _message: 'Network error' } : s));
    }
  };

  // ── Jump to letter ────────────────────────────────────────
  const handleLetterJump = (letter: string) => {
    if (!activeLetters.has(letter)) return;
    setJumpLetter(letter);
    const el = letterRefs.current[letter];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => setJumpLetter(null), 800);
  };

  // Group filtered artists by first letter
  const grouped = filteredArtists.reduce<Record<string, Artist[]>>((acc, a) => {
    const letter = a.name[0]?.toUpperCase() ?? '#';
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(a);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort();

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

  // ── Song list view ────────────────────────────────────────
  if (selectedArtist) {
    return (
      <>
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateX(16px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes fadeSlideBack {
            from { opacity: 0; transform: translateX(-16px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <FadeIn id={selectedArtist.name}>
          <div className="flex flex-col h-full">
            {/* Back header */}
            <div
              className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
              style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
            >
              <button
                onClick={() => { setSelectedArtist(null); setSongs([]); }}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-semibold"
                aria-label="Back to artists"
              >
                <ChevronLeft size={18} />
                Artists
              </button>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{selectedArtist.name}</p>
                <p className="text-xs text-slate-500">{selectedArtist.count} song{selectedArtist.count !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Songs */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 space-y-2">
              {loadingSongs && (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading songs...</span>
                </div>
              )}
              {!loadingSongs && songs.length === 0 && (
                <div className="text-center py-12">
                  <Music2 size={36} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No songs found</p>
                </div>
              )}
              {!loadingSongs && songs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{
                    background: song._status === 'success' ? 'rgba(34,197,94,0.06)' : 'var(--color-surface)',
                    border: `1px solid ${song._status === 'success' ? 'rgba(34,197,94,0.2)' : 'var(--color-border-subtle)'}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{song.title}</p>
                    <span className="text-xs text-slate-600 font-mono">#{song.code}</span>
                  </div>

                  {song._status === 'error' && song._message && (
                    <div className="flex items-center gap-1 shrink-0">
                      <AlertCircle size={13} className="text-red-400" />
                      <span className="text-xs text-red-300 max-w-20 truncate">{song._message}</span>
                    </div>
                  )}

                  <button
                    id={`artist-reserve-${song.id}`}
                    onClick={() => handleReserve(song)}
                    disabled={song._status === 'reserving' || song._status === 'success'}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: song._status === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
                      border: `1px solid ${song._status === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`,
                    }}
                    aria-label={`Reserve ${song.title}`}
                  >
                    {song._status === 'reserving' ? (
                      <Loader2 size={14} className="text-indigo-400 animate-spin" />
                    ) : song._status === 'success' ? (
                      <CheckCircle size={14} className="text-green-400" />
                    ) : (
                      <Plus size={14} className="text-indigo-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </>
    );
  }

  // ── Artist list view ──────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="flex flex-col h-full">
        {/* Search bar */}
        <div
          className="px-4 py-3 sticky top-0 z-10"
          style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="artist-search-input"
              type="search"
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              placeholder="Search artists..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm placeholder-slate-600 transition-all outline-none"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main artist list */}
          <div ref={listRef} className="flex-1 overflow-y-auto pb-6">
            {loadingArtists && (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading artists...</span>
              </div>
            )}

            {!loadingArtists && filteredArtists.length === 0 && (
              <div className="text-center py-16 px-4">
                <Users size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No artists found</p>
              </div>
            )}

            {!loadingArtists && letters.map((letter) => (
              <div key={letter} ref={(el) => { letterRefs.current[letter] = el; }}>
                {/* Letter header */}
                <div
                  className="px-4 py-1 text-xs font-black tracking-widest"
                  style={{
                    color: jumpLetter === letter ? '#a78bfa' : '#475569',
                    background: 'var(--color-bg)',
                    transition: 'color 0.3s',
                    position: 'sticky',
                    top: 60,
                    zIndex: 5,
                  }}
                >
                  {letter}
                </div>

                {/* Artist rows */}
                {grouped[letter].map((artist) => (
                  <button
                    key={artist.name}
                    id={`artist-btn-${artist.name.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => loadSongs(artist)}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                    style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Avatar circle */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#a78bfa' }}
                    >
                      {artist.name[0]?.toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                      <p className="text-xs text-slate-600">{artist.count} song{artist.count !== 1 ? 's' : ''}</p>
                    </div>

                    <ChevronRight size={16} className="text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* A-Z side scrubber */}
          {!artistFilter && (
            <div
              className="flex flex-col items-center justify-center py-2 px-1 shrink-0 select-none"
              style={{ width: '24px' }}
            >
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleLetterJump(letter)}
                  className="text-center leading-none transition-colors"
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 0',
                    width: '100%',
                    color: activeLetters.has(letter)
                      ? jumpLetter === letter ? '#a78bfa' : '#64748b'
                      : '#1e293b',
                    cursor: activeLetters.has(letter) ? 'pointer' : 'default',
                  }}
                  aria-label={`Jump to ${letter}`}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
