'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic2, Tv2, Smartphone, Music2, ChevronRight, Wifi } from 'lucide-react';
import { getOrCreateGuestSession } from '@/lib/auth/guestSession';
import Ballpit from '@/components/Ballpit/Ballpit';

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
      {/* 3D Interactive Auto-Floating Ballpit Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Ballpit
          count={55}
          gravity={0}
          friction={0.999}
          wallBounce={0.98}
          followCursor={true}
          colors={[0x050505, 0xffffff, 0x111111, 0xefefef, 0x000000, 0xffffff]}
        />
      </div>

      {/* Ambient decorative glow overlays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
      </div>

      {/* Outer Content Container */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-fadeIn">
        {/* Logo & Brand (Floating outside white card) */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="flex items-center justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/okekaraokelogo.png"
              alt="OKEKARAOKE Logo"
              className="w-36 h-36 md:w-44 md:h-44 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-md" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
            <span className="text-indigo-400">
              OKE
            </span>
            <span className="text-white">KARAOKE</span>
          </h1>
        </div>

        {/* White Frosted Card Container */}
        <div className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/80 p-6 sm:p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-slate-900">

        {/* How it works */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-100/90 border border-slate-200 p-4 rounded-2xl text-center">
            <Tv2 size={24} className="text-indigo-600 mx-auto mb-1.5" />
            <p className="text-sm font-bold text-slate-900">TV Screen</p>
            <p className="text-xs text-slate-500 mt-0.5">Karaoke display</p>
          </div>
          <div className="bg-slate-100/90 border border-slate-200 p-4 rounded-2xl text-center">
            <Smartphone size={24} className="text-indigo-600 mx-auto mb-1.5" />
            <p className="text-sm font-bold text-slate-900">Phone Remote</p>
            <p className="text-xs text-slate-500 mt-0.5">Search &amp; reserve</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200 animate-fade-in">
            {error}
          </div>
        )}

        {/* Create Room Button */}
        <button
          id="create-room-btn"
          onClick={handleCreate}
          disabled={creating || joining}
          className="w-full py-4 px-6 rounded-2xl font-black text-white text-base md:text-lg mb-4 transition-all duration-200 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          {creating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-white font-black">CREATING OKEKARAOKE...</span>
            </>
          ) : (
            <>
              <Music2 size={20} className="text-white stroke-[2.5]" />
              <span className="text-white font-black">CREATE OKEKARAOKE</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">or join a room</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Join Room Form */}
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
              className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-400 font-bold tracking-widest text-center text-base md:text-lg transition-all duration-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
            />
          </div>

          <button
            id="join-room-btn"
            type="submit"
            disabled={creating || joining || joinCode.length < 4}
            className="w-full py-4 px-6 rounded-2xl font-bold text-white text-base md:text-lg transition-all duration-200 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
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
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          © {new Date().getFullYear()} <span className="text-slate-600 font-semibold">Wilbert Gamis</span> · All Rights Reserved
        </p>
      </div>
    </div>
  </main>
  );
}
