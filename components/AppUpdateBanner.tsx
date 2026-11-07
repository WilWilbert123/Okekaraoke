'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Download, X, ExternalLink } from 'lucide-react';

interface VersionInfo {
  latestVersion: string;
  versionCode?: number;
  playStoreUrl: string;
  marketUrl?: string;
  releaseNotes?: string;
}

function isNewerVersion(latest: string, current: string): boolean {
  const lParts = latest.split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
    const l = lParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export function AppUpdateBanner() {
  const [show, setShow] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || '';
    const isMobileApp =
      ua.includes('OkeKaraokeMobile') ||
      (typeof document !== 'undefined' && document.referrer.includes('android-app://com.okekaraoke.app'));

    // Only show for users accessing from the installed mobile application
    if (!isMobileApp) return;

    // Extract current app version from User-Agent (defaults to 1.0.0 if not specified)
    const match = ua.match(/OkeKaraokeMobile\/([0-9.]+)/i);
    const installedVersion = match ? match[1] : '1.0.0';

    async function checkVersion() {
      try {
        const res = await fetch('/api/app-version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.latestVersion) return;

        // Check if user already dismissed this specific version update
        const dismissedKey = `okekaraoke_dismissed_update_${data.latestVersion}`;
        const isDismissed = localStorage.getItem(dismissedKey);
        if (isDismissed) return;

        // Check if latest version is newer than installed version
        if (isNewerVersion(data.latestVersion, installedVersion)) {
          setVersionInfo(data);
          setShow(true);
        }
      } catch (err) {
        console.warn('Failed to check app version:', err);
      }
    }

    checkVersion();
  }, []);

  const handleUpdate = () => {
    if (!versionInfo) return;
    const targetUrl = versionInfo.marketUrl || versionInfo.playStoreUrl;

    try {
      // First attempt to launch native Google Play Store app directly
      window.location.href = targetUrl;
      setTimeout(() => {
        // Fallback to web Play Store link in case market:// scheme fails
        window.open(versionInfo.playStoreUrl, '_blank', 'noopener,noreferrer');
      }, 500);
    } catch {
      window.open(versionInfo.playStoreUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = () => {
    setIsClosing(true);
    if (versionInfo?.latestVersion) {
      try {
        localStorage.setItem(`okekaraoke_dismissed_update_${versionInfo.latestVersion}`, '1');
      } catch (e) {
        console.warn(e);
      }
    }
    setTimeout(() => {
      setShow(false);
      setIsClosing(false);
    }, 280);
  };

  if (!show || !versionInfo) return null;

  return (
    <aside
      aria-label="App update announcement"
      className={`relative z-50 overflow-hidden transition-all duration-300 ease-out border-b border-teal-500/30 ${
        isClosing ? 'max-h-0 opacity-0 -translate-y-2 py-0' : 'max-h-24 opacity-100 translate-y-0'
      }`}
      style={{
        background: 'linear-gradient(90deg, rgba(13, 148, 136, 0.25) 0%, rgba(20, 20, 26, 0.98) 50%, rgba(13, 148, 136, 0.18) 100%)',
      }}
    >
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs">
        {/* Left Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/20">
            <Sparkles size={14} className="text-teal-300 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-[11px] tracking-tight">Update Available</span>
              <span className="px-1.5 py-0.2 rounded-full bg-teal-400/20 text-teal-300 text-[9px] font-mono font-bold border border-teal-400/30">
                v{versionInfo.latestVersion}
              </span>
            </div>
            <p className="text-[10px] text-zinc-300 truncate font-medium">
              New features on Google Play Store
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUpdate}
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-black font-extrabold text-[11px] flex items-center gap-1 shadow-md shadow-teal-500/20 active:scale-95 transition-all"
            title="Open Google Play Store to update"
          >
            <Download size={11} className="stroke-[3]" />
            <span>Update</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white transition-all active:scale-90"
            title="Dismiss update notice"
            aria-label="Dismiss update notice"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

