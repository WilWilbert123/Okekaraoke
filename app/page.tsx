'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic2, Tv2, Smartphone, Music2, ChevronRight, Wifi, Download, History, QrCode } from 'lucide-react';
import { getOrCreateGuestSession } from '@/lib/auth/guestSession';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import Ballpit from '@/components/Ballpit/Ballpit';
import { IntroSplash } from '@/components/IntroSplash';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [lastTvRoom, setLastTvRoom] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>('classic');
  const { isInstallable, isStandalone, installApp } = usePWAInstall();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('okekaraoke_last_room');
      if (saved) {
        setLastRoom(saved);
      }
      const savedTv = localStorage.getItem('okekaraoke_last_tv_room');
      if (savedTv) {
        setLastTvRoom(savedTv);
      }
    }

    // Fetch initial theme
    const fetchTheme = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data?.success && data?.data?.theme) {
          setTheme(data.data.theme);
        }
      } catch (err) {}
    };
    fetchTheme();

    // Subscribe to realtime updates for theme
    const supabase = createClient();
    
    // Fallback: Listen to postgres changes if column exists
    const dbSub = supabase
      .channel('public:app_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.global_settings' },
        (payload: any) => {
          if (payload.new?.theme) {
            setTheme(payload.new.theme);
          }
        }
      )
      .subscribe();

    // Primary: Listen to global broadcast (works even before DB column is created)
    const broadcastSub = supabase
      .channel('okekaraoke:global')
      .on(
        'broadcast',
        { event: 'banner_updated' },
        (payload: any) => {
          if (payload.payload?.theme) {
            setTheme(payload.payload.theme);
          }
        }
      )
      .subscribe();

    return () => {
      dbSub.unsubscribe();
      broadcastSub.unsubscribe();
    };
  }, []);

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

      const { updateGuestSession } = await import('@/lib/auth/guestSession');
      updateGuestSession({
        instance_id: json.data.instance.id,
        room_code,
        device_type: 'tv',
      });

      localStorage.setItem('okekaraoke_last_tv_room', room_code);

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
    <main className="min-h-dvh flex flex-col items-center justify-start px-3 sm:px-4 py-6 sm:py-10 relative overflow-x-hidden overflow-y-auto">
      {/* Animated Intro Splash Screen */}
      <IntroSplash />

      {/* 3D Interactive Auto-Floating Ballpit Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <Ballpit
          count={55}
          gravity={0}
          friction={0.9995}
          wallBounce={0.99}
          followCursor={true}
          theme={theme}
          colors={
            theme === 'christmas' ? [0x2DD4BF, 0x8B5CF6, 0x3B82F6, 0xEC4899, 0xA855F7, 0x06B6D4] :
            theme === '90s' ? [0xFF00FF, 0x00FFFF, 0xFFFF00, 0xFF0055] :
            theme === 'bubble' ? [0xA5F3FC, 0xFBCFE8, 0xE0E7FF, 0xFFFFFF] :
            theme === 'summer' ? [0xF59E0B, 0xEF4444, 0xEC4899, 0xFCD34D] :
            theme === 'rainy' ? [0x1E3A8A, 0x3B82F6, 0x64748B, 0x94A3B8, 0x0F172A] :
            theme === 'normal' ? [0x2DD4BF, 0x8B5CF6, 0x3B82F6, 0xEC4899, 0xA855F7, 0x06B6D4] :
            [0x050505, 0xffffff, 0x111111, 0xefefef, 0x000000, 0xffffff] // classic
          }
        />
      </div>

      {/* Ambient decorative glow overlays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
      </div>

      {/* Outer Content Container — my-auto keeps it centered on tall screens, scrolls on short TV screens */}
      <div className="relative z-10 w-full max-w-[340px] sm:max-w-md flex flex-col items-center animate-fadeIn my-auto">

        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 mb-4 sm:mb-6 filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">

          <img
            src="/okekaraokelogo.png"
            alt="OKEKARAOKE Logo"
            className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 object-contain"
          />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
            <span className="text-teal-400">
              OKE
            </span>
            <span className="text-white">KARAOKE</span>
          </h1>
        </div>

        {/* White Frosted Card Container */}
        <div className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/80 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-slate-900">

          {/* How it works */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="bg-slate-100/90 border border-slate-200 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-center">
              <Tv2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 mx-auto mb-1 sm:mb-1.5" />
              <p className="text-xs sm:text-sm font-bold text-slate-900">TV Screen</p>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Karaoke display</p>
            </div>
            <div className="bg-slate-100/90 border border-slate-200 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-center">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 mx-auto mb-1 sm:mb-1.5" />
              <p className="text-xs sm:text-sm font-bold text-slate-900">Phone Remote</p>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Search &amp; reserve</p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 animate-fade-in">
              {error}
            </div>
          )}

          {/* Create Room Button */}
          <button
            id="create-room-btn"
            onClick={handleCreate}
            disabled={creating || joining}
            className="w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-black text-white text-sm sm:text-base md:text-lg mb-3 sm:mb-4 transition-all duration-200 flex items-center justify-center gap-2 bg-slate-900 hover:bg-black active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white font-black">CREATING OKEKARAOKE...</span>
              </>
            ) : (
              <>
                <Music2 className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
                <span className="text-white font-black">CREATE OKEKARAOKE</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">or join a room</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Rejoin Last Room Buttons if available */}
          {lastTvRoom && (
            <div className="mb-3 sm:mb-4">
              <button
                onClick={() => {
                  router.push(`/tv/${lastTvRoom}`);
                }}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Tv2 size={15} className="text-teal-600" />
                  <span>Resume TV Display: <strong className="text-teal-900 font-extrabold tracking-wider">{lastTvRoom}</strong></span>
                </div>
                <ChevronRight size={15} className="text-teal-600" />
              </button>
            </div>
          )}

          {lastRoom && (
            <div className="mb-3 sm:mb-4">
              <button
                onClick={() => {
                  setJoinCode(lastRoom);
                  router.push(`/remote/${lastRoom}`);
                }}
                className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <History size={15} className="text-indigo-600" />
                  <span>Rejoin Last Room: <strong className="text-indigo-900 font-extrabold tracking-wider">{lastRoom}</strong></span>
                </div>
                <ChevronRight size={15} className="text-indigo-600" />
              </button>
            </div>
          )}

          {/* Join Room Form (Inline Input + Integrated Button) */}
          <form onSubmit={handleJoin}>
            <div className="relative flex items-center">
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                id="join-code-input"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER ROOM CODE"
                maxLength={8}
                className="w-full pl-10 sm:pl-11 pr-24 sm:pr-28 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-400 font-bold tracking-widest text-xs sm:text-sm md:text-base transition-all duration-200 focus:bg-white focus:border-black focus:ring-2 focus:ring-slate-300 outline-none"
              />
              <button
                id="join-room-btn"
                type="submit"
                disabled={creating || joining || joinCode.length < 4}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-white text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-1.5 bg-black hover:bg-slate-900 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {joining ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>JOINING</span>
                  </>
                ) : (
                  <>
                    <span>JOIN ROOM</span>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* PWA Mobile App Installation Prompt */}
          {!isStandalone && (
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-200/80 text-center">
              <button
                onClick={installApp}
                className="w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-800 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Download size={14} className="text-indigo-600" />
                <span>Install App</span>
              </button>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[11px] sm:text-xs text-slate-400 mt-4 sm:mt-6 font-medium">
            © {new Date().getFullYear()} <span className="text-slate-600 font-semibold">Wilbert Gamis</span> · All Rights Reserved
          </p>
        </div>
      </div>
    </main>
  );
}
