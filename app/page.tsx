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
  const [selectedMode, setSelectedMode] = useState<'tv' | 'solo'>('solo');
  const [joinCode, setJoinCode] = useState('');
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [lastTvRoom, setLastTvRoom] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingSolo, setCreatingSolo] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joiningTv, setJoiningTv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>('classic');
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
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
      setIsMobileDevice(/Mobi|Android|iPhone|iPad|iPod|SmartTV|Tizen|WebOS/i.test(navigator.userAgent));
    }

    // Fetch initial theme
    const fetchTheme = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (data?.success && data?.data?.theme) {
          setTheme(data.data.theme);
        }
      } catch (err) { }
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

  const handleCreateSoloTV = async () => {
    setCreatingSolo(true);
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
        device_type: 'remote',
      });

      localStorage.setItem('okekaraoke_last_room', room_code);
      localStorage.setItem('okekaraoke_solo_tv', 'true');

      router.push(`/remote/${room_code}?solotv=true`);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setCreatingSolo(false);
    }
  };

  // Open TV Display screen for existing room code (for TV devices)
  const handleJoinTv = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();

    if (code.length < 4) {
      setError('Please enter a valid room code.');
      return;
    }

    setJoiningTv(true);
    setError(null);

    try {
      const session = getOrCreateGuestSession();

      const response = await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: code,
          guest_session_id: session.session_id,
          device_type: 'tv',
          guest_name: 'TV Screen',
        }),
      });

      const json = await response.json();

      if (!json.success) {
        setError(json.error?.message ?? 'TV Room not found. Check the code and try again.');
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
      setJoiningTv(false);
    }
  };

  // Join Phone Remote or Solo TV
  const handleJoinRemote = async (e: React.FormEvent, isSolo = false) => {
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

      localStorage.setItem('okekaraoke_last_room', room_code);

      if (isSolo) {
        localStorage.setItem('okekaraoke_solo_tv', 'true');
        router.push(`/remote/${room_code}?solotv=true`);
      } else {
        router.push(`/remote/${room_code}`);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setJoining(false);
    }
  };

  const solidThemes = ['black', 'dark', 'navy', 'purple', 'none', 'solid_black'];
  const isSolidTheme = solidThemes.includes(theme);

  const getBackgroundColor = () => {
    if (theme === 'black' || theme === 'solid_black') return 'bg-black';
    if (theme === 'dark') return 'bg-[#09090b]';
    if (theme === 'navy') return 'bg-[#060b19]';
    if (theme === 'purple') return 'bg-[#0f071b]';
    return 'bg-black';
  };

  return (
    <main className={`min-h-dvh flex flex-col items-center justify-start px-3 sm:px-4 py-6 sm:py-10 relative overflow-x-hidden overflow-y-auto ${getBackgroundColor()} transition-colors duration-500`}>
      {/* Animated Intro Splash Screen */}
      <IntroSplash />

      {/* 3D Interactive Auto-Floating Ballpit Background (Only rendered if NOT solid theme) */}
      {!isSolidTheme && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <Ballpit
            count={isMobileDevice ? 20 : 35}
            gravity={0}
            friction={0.9995}
            wallBounce={0.99}
            followCursor={!isMobileDevice}
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
      )}

      {/* Ambient decorative glow overlays */}
      {!isSolidTheme && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden="true">
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        </div>
      )}

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

          {/* Interactive Mode Segmented Selector */}
          <div className="p-1 rounded-2xl bg-slate-100/90 border border-slate-200 flex items-center gap-1 mb-4">
            <button
              type="button"
              onClick={() => setSelectedMode('tv')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all duration-200 ${selectedMode === 'tv'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Tv2 size={16} />
              <span>TV + Phone</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('solo')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all duration-200 ${selectedMode === 'solo'
                  ? 'bg-teal-400 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Smartphone size={16} />
              <span>1 Device</span>
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 animate-fade-in">
              {error}
            </div>
          )}

          {/* Clean Action Button & Mode Description */}
          <div className="mb-4 sm:mb-5">
            {selectedMode === 'solo' ? (
              <div>
                <button
                  id="create-solo-tv-btn"
                  onClick={handleCreateSoloTV}
                  disabled={creating || creatingSolo || joining}
                  className="w-full py-3.5 px-5 rounded-2xl font-black text-slate-950 text-sm sm:text-base flex items-center justify-center gap-2 bg-gradient-to-r from-teal-300 via-teal-400 to-cyan-300 hover:from-teal-400 hover:to-cyan-400 border border-teal-400/50 shadow-lg active:scale-[0.99] disabled:opacity-60 transition-all"
                >
                  {creatingSolo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>STARTING SOLO TV...</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 stroke-[2.5]" />
                      <span>CREATE SOLO TV ROOM</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] sm:text-xs text-slate-500 text-center mt-2 font-medium">
                  Sing &amp; search directly on 1 phone (No TV screen required)
                </p>
              </div>
            ) : (
              <div>
                <button
                  id="create-room-btn"
                  onClick={handleCreate}
                  disabled={creating || creatingSolo || joining}
                  className="w-full py-3.5 px-5 rounded-2xl font-black text-white text-sm sm:text-base flex items-center justify-center gap-2 bg-slate-900 hover:bg-black shadow-lg active:scale-[0.99] disabled:opacity-60 transition-all"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>CREATING TV ROOM...</span>
                    </>
                  ) : (
                    <>
                      <Music2 className="w-4 h-4 stroke-[2.5]" />
                      <span>CREATE TV DISPLAY ROOM</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] sm:text-xs text-slate-500 text-center mt-2 font-medium">
                  Displays karaoke lyrics on Smart TV, Laptop, or Tablet
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">or join a room</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Rejoin Bar — Title on top, 3 compact buttons in 1 row */}
          {(lastTvRoom || lastRoom) && (
            <div className="mb-3 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-100/80 border border-slate-200/80 flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <History className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-[10px] sm:text-xs font-extrabold text-slate-600 tracking-wider uppercase">
                    {lastTvRoom && lastRoom && lastTvRoom === lastRoom ? (
                      <>Rejoin Room <span className="font-mono text-indigo-900 font-black tracking-wider lowercase">({lastRoom})</span></>
                    ) : (
                      <>Rejoin Recent Session</>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                {lastTvRoom && (
                  <button
                    onClick={() => router.push(`/tv/${lastTvRoom}`)}
                    className="flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-950 border border-teal-400/40 text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    title={`Resume TV Display (${lastTvRoom})`}
                  >
                    <Tv2 size={11} className="text-teal-700 shrink-0" />
                    <span className="truncate">{lastTvRoom === lastRoom ? 'TV' : `TV ${lastTvRoom}`}</span>
                  </button>
                )}

                {lastRoom && (
                  <>
                    <button
                      onClick={() => {
                        setJoinCode(lastRoom);
                        router.push(`/remote/${lastRoom}`);
                      }}
                      className="flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-950 border border-indigo-400/40 text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                      title={`Rejoin Phone Remote (${lastRoom})`}
                    >
                      <History size={11} className="text-indigo-700 shrink-0" />
                      <span className="truncate">{lastTvRoom === lastRoom ? 'Remote' : `Remote ${lastRoom}`}</span>
                    </button>

                    <button
                      onClick={() => {
                        localStorage.setItem('okekaraoke_solo_tv', 'true');
                        router.push(`/remote/${lastRoom}?solotv=true`);
                      }}
                      className="flex-1 py-1 sm:py-1.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-950 border border-emerald-400/40 text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                      title={`Rejoin as Solo TV (${lastRoom})`}
                    >
                      <Smartphone size={11} className="text-emerald-700 shrink-0" />
                      <span className="truncate">Solo TV</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Join Room Form — Mode-Aware TV Display & Remote Room Code Launcher */}
          {selectedMode === 'tv' ? (
            <form onSubmit={handleJoinTv} className="flex flex-col gap-2">
              <div className="relative flex items-center">
                <Tv2 className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <input
                  id="join-tv-code-input"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ENTER TV ROOM CODE (e.g. JU7U)"
                  maxLength={8}
                  className="w-full pl-10 sm:pl-11 pr-3 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-400 font-bold tracking-widest text-xs sm:text-sm transition-all focus:bg-white focus:border-black outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="open-tv-btn"
                  type="submit"
                  disabled={creating || creatingSolo || joining || joiningTv || joinCode.length < 4}
                  className="flex-1 py-3 px-4 rounded-xl sm:rounded-2xl font-black text-white text-xs sm:text-sm bg-slate-900 hover:bg-black flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {joiningTv ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>OPENING TV DISPLAY...</span>
                    </>
                  ) : (
                    <>
                      <Tv2 size={15} />
                      <span>OPEN TV DISPLAY</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleJoinRemote(e, false)}
                  disabled={creating || creatingSolo || joining || joiningTv || joinCode.length < 4}
                  className="py-3 px-3 rounded-xl sm:rounded-2xl font-extrabold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs flex items-center justify-center gap-1 active:scale-[0.98] disabled:opacity-40 shrink-0 transition-all"
                  title="Join room as Phone Remote"
                >
                  <span>Join Remote</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => handleJoinRemote(e, true)} className="relative flex items-center">
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <input
                id="join-code-input"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER ROOM CODE"
                maxLength={8}
                className="w-full pl-10 sm:pl-11 pr-28 sm:pr-32 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-400 font-bold tracking-widest text-xs sm:text-sm md:text-base transition-all duration-200 focus:bg-white focus:border-black focus:ring-2 focus:ring-slate-300 outline-none font-mono"
              />
              <button
                id="join-room-btn"
                type="submit"
                disabled={creating || creatingSolo || joining || joiningTv || joinCode.length < 4}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-slate-950 text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-1.5 bg-teal-400 hover:bg-teal-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {joining ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>JOINING...</span>
                  </>
                ) : (
                  <>
                    <span>JOIN SOLO TV</span>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </>
                )}
              </button>
            </form>
          )}

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
