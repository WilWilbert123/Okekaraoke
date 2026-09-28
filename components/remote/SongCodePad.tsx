'use client';

// ============================================================
// OKEKARAOKE — Song Code Pad
// Numeric keypad for entering song codes directly
// ============================================================

import { useState, useCallback } from 'react';
import { Delete, Music2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Song } from '@/lib/types';

interface SongCodePadProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
  onReserved: () => void;
}

type ReserveStatus = 'idle' | 'looking_up' | 'found' | 'not_found' | 'reserving' | 'success' | 'error';

export function SongCodePad({ roomCode, sessionId, guestName, onReserved }: SongCodePadProps) {
  const [code, setCode] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [status, setStatus] = useState<ReserveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const lookupSong = useCallback(async (songCode: string) => {
    if (songCode.length < 1) return;
    setStatus('looking_up');
    setSong(null);

    try {
      const response = await fetch(`/api/songs/code/${encodeURIComponent(songCode)}`);
      const json = await response.json();

      if (json.success && json.data.song) {
        setSong(json.data.song);
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    } catch {
      setStatus('not_found');
    }
  }, []);

  const handleKey = (digit: string) => {
    if (code.length >= 8) return;
    const newCode = code + digit;
    setCode(newCode);
    setStatus('idle');
    setSong(null);
  };

  const handleClear = () => {
    setCode('');
    setSong(null);
    setStatus('idle');
    setErrorMessage('');
  };

  const handleBackspace = () => {
    const newCode = code.slice(0, -1);
    setCode(newCode);
    setSong(null);
    setStatus('idle');
  };

  const handleSearch = () => {
    if (code.trim().length > 0) {
      lookupSong(code.trim());
    }
  };

  const handleReserve = async () => {
    if (!song || !sessionId) return;

    setStatus('reserving');
    setErrorMessage('');

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
        setStatus('success');
        onReserved();
        setTimeout(() => {
          setCode('');
          setSong(null);
          setStatus('idle');
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(json.error?.message ?? 'Failed to reserve song.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="p-4 space-y-4">
      {/* Code display */}
      <div
        className="rounded-xl p-4 text-center min-h-[72px] flex flex-col items-center justify-center"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
      >
        {code ? (
          <p
            className="text-4xl font-black text-white tracking-widest"
            style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.3em' }}
          >
            {code}
          </p>
        ) : (
          <p className="text-slate-600 text-sm">Enter song code</p>
        )}
      </div>

      {/* Song lookup result */}
      {status === 'looking_up' && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Looking up song...</span>
        </div>
      )}

      {status === 'not_found' && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        >
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">Song not found. Check the code and try again.</p>
        </div>
      )}

      {(status === 'found' || status === 'reserving' || status === 'success' || status === 'error') && song && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
            <Music2 size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{song.title}</p>
            <p className="text-sm text-slate-400 truncate">{song.artist}</p>
          </div>
          <span className="text-xs font-mono text-slate-600">#{song.code}</span>
        </div>
      )}

      {status === 'success' && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl animate-fade-in"
          style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
        >
          <CheckCircle size={16} className="text-green-400 shrink-0" />
          <p className="text-sm text-green-300 font-medium">Song reserved! Check &ldquo;Mine&rdquo; tab.</p>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
        >
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{errorMessage}</p>
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {digits.map((d) => (
          <button
            key={d}
            id={`keypad-${d}`}
            onClick={() => handleKey(d)}
            className="h-14 rounded-xl text-2xl font-bold text-white transition-all active:scale-95"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {d}
          </button>
        ))}

        {/* Bottom row */}
        <button
          id="keypad-clear"
          onClick={handleClear}
          className="h-14 rounded-xl text-sm font-bold text-slate-400 transition-all active:scale-95"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          CLEAR
        </button>

        <button
          id="keypad-0"
          onClick={() => handleKey('0')}
          className="h-14 rounded-xl text-2xl font-bold text-white transition-all active:scale-95"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
        >
          0
        </button>

        <button
          id="keypad-backspace"
          onClick={handleBackspace}
          className="h-14 rounded-xl flex items-center justify-center text-slate-400 transition-all active:scale-95"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          aria-label="Backspace"
        >
          <Delete size={20} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="code-search-btn"
          onClick={handleSearch}
          disabled={code.length === 0 || status === 'looking_up'}
          className="h-12 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}
        >
          LOOK UP
        </button>

        <button
          id="code-reserve-btn"
          onClick={handleReserve}
          disabled={!song || status === 'reserving' || status === 'success'}
          className="h-12 rounded-xl font-bold text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: song ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'var(--color-surface-3)',
            border: song ? 'none' : '1px solid var(--color-border)',
            boxShadow: song ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
          }}
        >
          {status === 'reserving' ? (
            <><Loader2 size={16} className="animate-spin" /> RESERVING...</>
          ) : status === 'success' ? (
            <><CheckCircle size={16} /> RESERVED</>
          ) : (
            'RESERVE'
          )}
        </button>
      </div>
    </div>
  );
}
