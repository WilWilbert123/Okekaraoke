'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic2, Tv2, Smartphone, Music2, ChevronRight, Wifi } from 'lucide-react';
import { getOrCreateGuestSession } from '@/lib/auth/guestSession';

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      const session = getOrCreateGuestSession();

      const response = await fetch('/api/instances/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_session_id: session.session_id }),
      });

      const json = await response.json();

      if (!json.success) {
        setError(json.error?.message ?? 'Failed to create room. Please try again.');
        return;
      }

      const { room_code } = json.data;

      // Update session with instance info
      const { updateGuestSession } = await import('@/lib/auth/guestSession');
      updateGuestSession({
        instance_id: json.data.instance.id,
        room_code,
        device_type: 'tv',
      });

      router.push(`/tv/${room_code}`);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();

    if (code.length < 4) {
      setError('Please enter a valid room code.');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const session = getOrCreateGuestSession();

      const response = await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: code,
          guest_session_id: session.session_id,
          device_type: 'remote',
        }),
      });

      const json = await response.json();

      if (!json.success) {
        setError(json.error?.message ?? 'Room not found. Check the code and try again.');
        return;
      }

      const { room_code } = json.data;

      const { updateGuestSession } = await import('@/lib/auth/guestSession');
      updateGuestSession({
        instance_id: json.data.instance.id,
        room_code,
        device_type: 'remote',
      });

      router.push(`/remote/${room_code}`);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/okekaraokelogo.png"
              alt="OKEKARAOKE Logo"
              className="w-44 h-44 md:w-52 md:h-52 object-contain drop-shadow-[0_0_35px_rgba(99,102,241,0.4)]"
            />
          </div>

          <h1 className="text-5xl font-black tracking-tight mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
            <span style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 50%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              OKE
            </span>
            <span className="text-white">KARAOKE</span>
          </h1>

        </div>

        {/* How it works */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="glass rounded-xl p-4 text-center">
            <Tv2 size={24} className="text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">TV Screen</p>
            <p className="text-xs text-slate-400 mt-1">Karaoke display</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <Smartphone size={24} className="text-violet-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">Phone Remote</p>
            <p className="text-xs text-slate-400 mt-1">Search &amp; reserve</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm text-red-300 animate-fade-in"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {error}
          </div>
        )}

        {/* Create */}
        <button
          id="create-room-btn"
          onClick={handleCreate}
          disabled={creating || joining}
          className="w-full py-4 px-6 rounded-xl font-bold text-white text-lg mb-4 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: creating
              ? 'rgba(99, 102, 241, 0.5)'
              : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
            boxShadow: creating ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.4)',
          }}
        >
          {creating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              CREATING OKEKARAOKE...
            </>
          ) : (
            <>
              <Music2 size={20} />
              CREATE OKEKARAOKE
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
          <span className="text-sm text-slate-500">or join a room</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        </div>

        {/* Join */}
        <form onSubmit={handleJoin} className="space-y-3">
          <div className="relative">
            <Wifi size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="join-code-input"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE"
              maxLength={8}
              className="w-full pl-11 pr-4 py-4 rounded-xl text-white placeholder-slate-500 font-bold tracking-widest text-center text-lg transition-all duration-200"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            id="join-room-btn"
            type="submit"
            disabled={creating || joining || joinCode.length < 4}
            className="w-full py-4 px-6 rounded-xl font-bold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {joining ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                JOINING...
              </>
            ) : (
              <>
                JOIN ROOM
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-8">
          © {new Date().getFullYear()} <span className="text-slate-500 font-medium">Wilbert Gamis</span> · All Rights Reserved
        </p>
      </div>
    </main>
  );
}
