'use client';

// ============================================================
// OKEKARAOKE — Master Admin Dashboard
// Professional, icon-based, real-time control system
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Edit,
  Trash2,
  ShieldCheck,
  Tv,
  Smartphone,
  Music2,
  Activity,
  Globe,
  Radio,
  RefreshCw,
  LogOut,
  Layers,
  Image as ImageIcon,
  CheckCircle,
  Plus,
  Power,
  AlertTriangle,
  Users,
  Clock,
  TrendingUp,
  Wifi,
  WifiOff,
  MessageSquare,
  Upload,
  Megaphone,
  Pin,
  Layout,
  Sparkles,
  Database,
  FileText,
  HardDrive,
  Server,
  PieChart,
  Sun,
  CloudRain,
  Circle,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface AnalyticsData {
  metrics: {
    active_rooms: number;
    online_devices: number;
    online_remotes?: number;
    total_songs: number;
    reservations_today: number;
  };
  current_location: {
    ip: string;
    country: string;
    city: string;
  };
  active_rooms_list: Array<{
    id: string;
    room_code: string;
    status: string;
    created_at: string;
    user_count: number;
    tv_count: number;
    remote_count: number;
    city: string;
    country: string;
    is_online: boolean;
    currently_playing?: { title: string; artist: string; guest_name?: string | null } | null;
    queue_count?: number;
    chat_count?: number;
  }>;
  online_devices_list: Array<{
    id: string;
    room_code: string;
    device_type: string;
    device_name: string;
    is_online: boolean;
    last_seen_at: string;
    city: string;
    country: string;
    ip_address: string;
  }>;
}

interface BannerSettings {
  banner_enabled: boolean;
  shoutout_enabled?: boolean;
  banner_type?: 'ticker' | 'side_card' | 'bottom_bar' | 'popup';
  banner_text: string;
  banner_image_url: string;
  banner_images?: string[];
  banner_speed: number;
  theme?: string;
}

interface Song {
  id: string;
  code: string;
  title: string;
  artist: string;
  category: string | null;
  language: string | null;
  is_active: boolean;
}

interface FeedbackItem {
  id: string;
  category: 'feedback' | 'bug' | 'song_request';
  message: string;
  guest_name?: string | null;
  room_code?: string | null;
  session_id?: string | null;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
}

type Tab = 'overview' | 'banner' | 'songs' | 'rooms' | 'feedbacks' | 'supabase_stats';

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  desc,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  desc: string;
}) {
  return (
    <div
      className="p-5 rounded-2xl transition-all"
      style={{
        background: 'rgba(18, 18, 28, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-black text-white mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500">{desc}</p>
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all"
      style={{
        color: active ? '#a78bfa' : '#64748b',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

// ─── Panel: Live Overview ─────────────────────────────────────────────────────
function OverviewTab({ analytics, onRefresh, loading }: { analytics: AnalyticsData | null; onRefresh?: () => void; loading?: boolean }) {
  const [deviceList, setDeviceList] = useState(analytics?.online_devices_list || []);

  useEffect(() => {
    if (analytics?.online_devices_list) {
      setDeviceList(analytics.online_devices_list);
    }
  }, [analytics?.online_devices_list]);

  const handleDeleteDevice = async (id: string) => {
    setDeviceList((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/admin/devices?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Error deleting device:', e);
    }
  };

  const handleClearOfflineDevices = async () => {
    setDeviceList((prev) => prev.filter((d) => d.is_online));
    try {
      await fetch('/api/admin/devices?clear_offline=true', { method: 'DELETE' });
    } catch (e) {
      console.error('Error clearing offline devices:', e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-380px)] min-h-[350px]">
      {/* Active TV Rooms */}
      <div
        className="p-5 rounded-2xl flex flex-col h-full overflow-hidden"
        style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Tv size={15} className="text-green-400" />
            <h2 className="text-sm font-bold text-white">
              Active TV Rooms ({analytics?.active_rooms_list.length ?? 0})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                title="Refresh active rooms & devices immediately"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin text-indigo-400' : ''} />
                <span>Refresh</span>
              </button>
            )}
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-green-400 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
              REALTIME
            </span>
          </div>
        </div>

        {!analytics?.active_rooms_list.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No active TV rooms right now.</p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {analytics.active_rooms_list.map((room) => {
              const isRoomLive = room.is_online && room.user_count > 0;
              return (
                <div
                  key={room.id}
                  className="p-3.5 rounded-xl flex items-center justify-between transition-all"
                  style={{
                    background: isRoomLive ? 'rgba(34, 197, 94, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isRoomLive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)'}`,
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isRoomLive ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
                      <span className="text-sm font-black text-white font-mono tracking-wider">
                        ROOM {room.room_code}
                      </span>
                    </div>

                    {/* Realtime User Count breakdown */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                      <Users size={12} className="text-indigo-400" />
                      <span>
                        {room.user_count} {room.user_count === 1 ? 'User' : 'Users'} connected
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({room.tv_count} TV, {room.remote_count} Remote{room.remote_count !== 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* Location info */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Globe size={11} className="text-slate-500" />
                      <span>
                        {room.city}, {room.country}
                      </span>
                      <span className="text-slate-600">·</span>
                      <Clock size={10} className="text-slate-600" />
                      <span className="text-slate-500">
                        {new Date(room.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isRoomLive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isRoomLive ? '● LIVE ONLINE' : 'IDLE / OFFLINE'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connected Remotes & Devices */}
      <div
        className="p-5 rounded-2xl flex flex-col h-full overflow-hidden"
        style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white">
              Connected Devices ({deviceList.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {deviceList.some((d) => !d.is_online) && (
              <button
                type="button"
                onClick={handleClearOfflineDevices}
                className="px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[10px] font-bold flex items-center gap-1 transition-all"
                title="Clear offline devices"
              >
                <Trash2 size={10} />
                <span>Clear Offline</span>
              </button>
            )}
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              REALTIME
            </span>
          </div>
        </div>

        {!deviceList.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No devices currently connected.</p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {deviceList.map((dev) => (
              <div
                key={dev.id}
                className="p-3.5 rounded-xl flex items-center justify-between transition-all"
                style={{
                  background: dev.is_online ? 'rgba(99, 102, 241, 0.03)' : 'rgba(255, 255, 255, 0.01)',
                  border: `1px solid ${dev.is_online ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)'}`,
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        dev.is_online ? 'bg-green-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <p className="text-xs font-bold text-white">{dev.device_name || 'Guest Remote'}</p>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Room {dev.room_code}
                    </span>
                  </div>

                  {/* Device location & IP */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Globe size={11} className="text-indigo-400 shrink-0" />
                    <span>
                      {dev.city}, {dev.country}
                    </span>
                    {dev.ip_address && (
                      <span className="text-[10px] text-slate-500 font-mono">({dev.ip_address})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dev.is_online ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                      <Wifi size={10} />
                      <span>ONLINE</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20 flex items-center gap-1">
                      <WifiOff size={10} />
                      <span>OFFLINE</span>
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase">
                    {dev.device_type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(dev.id)}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete device record"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Banner Settings ───────────────────────────────────────────────────
function BannerTab({
  banner,
  setBanner,
  onSave,
  saving,
  saved,
}: {
  banner: BannerSettings;
  setBanner: (b: BannerSettings) => void;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [newUrlInput, setNewUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  // Helper: Compress image to lightweight WebP data URL via HTML5 Canvas
  const compressImage = (file: File, maxWidth = 800, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const imagesList = (banner.banner_images && banner.banner_images.length > 0)
    ? banner.banner_images
    : (banner.banner_image_url ? [banner.banner_image_url] : []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const updatedImages = [...imagesList];

    for (let i = 0; i < files.length; i++) {
      try {
        const compressedDataUrl = await compressImage(files[i], 800, 0.82);
        updatedImages.push(compressedDataUrl);
      } catch (err) {
        console.error('File compression error:', err);
      }
    }

    setBanner({
      ...banner,
      banner_images: updatedImages,
      banner_image_url: updatedImages[0] || '',
    });
    setUploading(false);
    e.target.value = '';
  };

  const handleAddUrl = () => {
    if (!newUrlInput.trim()) return;
    const updatedImages = [...imagesList, newUrlInput.trim()];
    setBanner({
      ...banner,
      banner_images: updatedImages,
      banner_image_url: updatedImages[0] || '',
    });
    setNewUrlInput('');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updatedImages = imagesList.filter((_, idx) => idx !== indexToRemove);
    setBanner({
      ...banner,
      banner_images: updatedImages,
      banner_image_url: updatedImages[0] || '',
    });
  };

  return (
    <div
      className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[350px] overflow-y-auto custom-scrollbar gap-4"
      style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Radio size={17} className="text-indigo-400" />
          <span>Live TV Announcement Banner & Advertisement Manager</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Broadcast continuous text tickers, side ad cards, bottom bars, or popup banners to all active TV screens in real-time.
        </p>
      </div>

      {saved && (
        <div
          className="p-3 rounded-xl flex items-center gap-2 text-xs font-bold text-green-300"
          style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)' }}
        >
          <CheckCircle size={15} className="text-green-400" />
          <span>Banner settings saved and broadcast live to all TV screens!</span>
        </div>
      )}

      <form onSubmit={onSave} className="space-y-4">
        {/* Enable Toggles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Banner Enable Toggle */}
          <div
            className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer select-none"
            style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            onClick={() => setBanner({ ...banner, banner_enabled: !banner.banner_enabled })}
          >
            <div>
              <p className="text-xs font-bold text-white">Enable TV Advertisement Banner</p>
              <p className="text-[11px] text-slate-500">Show live banner overlay across active TV screens</p>
            </div>
            <div
              className="w-11 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0"
              style={{ background: banner.banner_enabled ? '#6366f1' : 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: banner.banner_enabled ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </div>
          </div>

          {/* Shoutout Enable Toggle */}
          <div
            className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer select-none"
            style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
            onClick={() => setBanner({ ...banner, shoutout_enabled: !(banner.shoutout_enabled ?? true) })}
          >
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Enable TV Room Shoutouts</span>
                <span className="text-[10px] text-emerald-400 font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">50 CHAR MAX</span>
              </p>
              <p className="text-[11px] text-slate-500">Allow phone remote users to broadcast live TV floating shoutouts</p>
            </div>
            <div
              className="w-11 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0"
              style={{ background: (banner.shoutout_enabled ?? true) ? '#10b981' : 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: (banner.shoutout_enabled ?? true) ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </div>
          </div>
        </div>

        {/* SELECT BACKGROUND THEME */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-400" />
            <span>Select Background Theme</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-6">
            {[
              { id: 'black', name: 'Solid Black', desc: '⚡ Zero Lag: Pure black background (Fastest for TV & Phones)', Icon: Circle },
              { id: 'dark', name: 'Solid Dark Slate', desc: '⚡ Zero Lag: Ultra-sleek dark slate background', Icon: Circle },
              { id: 'navy', name: 'Solid Midnight Navy', desc: '⚡ Zero Lag: Deep midnight blue background', Icon: Circle },
              { id: 'purple', name: 'Solid Deep Purple', desc: '⚡ Zero Lag: Luxury dark purple background', Icon: Circle },
              { id: 'classic', name: 'Classic 3D Spheres', desc: '3D animated black & white grayscale bubbles', Icon: Tv },
              { id: 'christmas', name: 'Christmas 3D Theme', desc: '3D animated colors with blinking lights effect', Icon: Sparkles },
              { id: '90s', name: '90s Retro 3D', desc: '3D animated neon colors and synthwave vibes', Icon: Radio },
              { id: 'bubble', name: 'Soap Bubble 3D', desc: '3D animated light cyan and pink bubbles', Icon: Circle },
              { id: 'summer', name: 'Summer Vibes 3D', desc: '3D animated warm sunset orange & pink', Icon: Sun },
              { id: 'rainy', name: 'Rainy Night 3D', desc: '3D animated deep blues and slate gray', Icon: CloudRain },
              { id: 'normal', name: 'Normal 3D Theme', desc: 'Standard 3D vibrant colors without blinking', Icon: ImageIcon },
            ].map((typeOption) => {
              const selected = (banner.theme || 'classic') === typeOption.id;
              const OptionIcon = typeOption.Icon;
              return (
                <div
                  key={typeOption.id}
                  onClick={() => setBanner({ ...banner, theme: typeOption.id })}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                    selected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <OptionIcon size={16} className={selected ? 'text-indigo-400' : 'text-slate-400'} />
                    {selected && <CheckCircle size={14} className="text-indigo-400" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{typeOption.name}</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{typeOption.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECT BANNER TYPE */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-400" />
            <span>Select Banner / Advertisement Display Type</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              { id: 'ticker', name: 'Top Header Ticker', desc: 'Running marquee ticker at top header', Icon: Tv },
              { id: 'side_card', name: 'Side Ad Box', desc: 'Floating glass ad card on top right side', Icon: Pin },
              { id: 'bottom_bar', name: 'Bottom Edge Bar', desc: 'Running ticker bar fixed along bottom edge', Icon: Layout },
              { id: 'popup', name: 'Slow Bouncing Card', desc: 'Smooth slow bouncing floating banner on screen', Icon: Sparkles },
            ].map((typeOption) => {
              const selected = (banner.banner_type || 'ticker') === typeOption.id;
              const OptionIcon = typeOption.Icon;
              return (
                <div
                  key={typeOption.id}
                  onClick={() => setBanner({ ...banner, banner_type: typeOption.id as any })}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                    selected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <OptionIcon size={16} className={selected ? 'text-indigo-400' : 'text-slate-400'} />
                    {selected && <CheckCircle size={14} className="text-indigo-400" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{typeOption.name}</p>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{typeOption.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Left Column: Announcement Text & Scroll Speed */}
          <div className="space-y-4">
            {/* Banner text */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Announcement Text / Ad Caption
              </label>
              <textarea
                rows={3}
                value={banner.banner_text}
                onChange={(e) => setBanner({ ...banner, banner_text: e.target.value })}
                placeholder="e.g. Welcome to OKEKARAOKE! Special promo: 20% off drinks & bucket beers tonight."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white outline-none transition-all placeholder-slate-600 resize-none"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              />
            </div>

            {/* Scroll speed */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Ticker Scroll Speed: <span className="text-indigo-300">{banner.banner_speed}s</span>
              </label>
              <input
                type="range"
                min="8"
                max="40"
                value={banner.banner_speed}
                onChange={(e) => setBanner({ ...banner, banner_speed: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>Fast (8s)</span>
                <span>Slow (40s)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Multiple Images & Direct File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-indigo-400" />
                  <span>Advertisement Images ({imagesList.length})</span>
                </span>
                <span className="text-[10px] text-indigo-300">Auto-compressed Lightweight WebP</span>
              </label>

              {/* Upload or Add URL Input */}
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={newUrlInput}
                    onChange={(e) => setNewUrlInput(e.target.value)}
                    placeholder="Paste image URL (https://...)"
                    className="flex-1 px-3 py-2 rounded-xl text-xs text-white outline-none placeholder-slate-600 font-mono"
                    style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    disabled={!newUrlInput.trim()}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>

                <div className="relative">
                  <label
                    htmlFor="banner-file-upload"
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Upload size={14} />
                    <span>{uploading ? 'Compressing & Adding Image...' : 'Upload Local Image File (Auto-Compress)'}</span>
                  </label>
                  <input
                    id="banner-file-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Image Thumbnails Gallery */}
              {imagesList.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto custom-scrollbar p-1.5 rounded-xl bg-white/[0.02] border border-white/5">
                  {imagesList.map((imgUrl, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={`Ad ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="p-1 rounded-md bg-red-600 text-white hover:bg-red-500 transition-all active:scale-90"
                          title="Remove image"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <span className="absolute bottom-0.5 left-1 text-[9px] font-black text-white px-1 bg-black/70 rounded">
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic text-center py-3 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
                  No images added yet. Paste a URL or click upload to add lightweight ad images.
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all active:scale-95 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
        >
          {saving ? 'Publishing Live...' : 'Save & Broadcast to All TV Screens'}
        </button>
      </form>

      {/* Live TV Shoutout Monitoring Section */}
      <AdminShoutoutMonitor />
    </div>
  );
}

// ─── Sub-component: Live Admin Shoutout Monitor ────────────────────────────────
function AdminShoutoutMonitor() {
  const [shoutouts, setShoutouts] = useState<Array<{ id: string; room_code: string; guest_name: string; message: string; created_at?: string; sent_at?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchShoutouts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shoutouts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setShoutouts(json.data);
        }
      }
    } catch (e) {
      console.warn('Error fetching shoutouts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteShoutout = async (id: string) => {
    setShoutouts((prev) => prev.filter((item) => item.id !== id));
    try {
      await fetch(`/api/admin/shoutouts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Error deleting shoutout:', e);
    }
  };

  const handleClearAllShoutouts = async () => {
    if (!window.confirm('Are you sure you want to delete ALL shoutouts from Supabase?')) return;
    setClearing(true);
    setShoutouts([]);
    try {
      await fetch('/api/admin/shoutouts?all=true', { method: 'DELETE' });
    } catch (e) {
      console.error('Error clearing all shoutouts:', e);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-indigo-400" />
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Live Room Shoutouts Monitoring</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[10px] text-slate-400">Real-time broadcast log across all active TV rooms</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchShoutouts}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          {shoutouts.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllShoutouts}
              disabled={clearing}
              className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition-all text-[11px] font-bold flex items-center gap-1"
            >
              <Trash2 size={12} />
              <span>{clearing ? 'Clearing...' : 'Clear All Shoutouts'}</span>
            </button>
          )}
        </div>
      </div>

      {shoutouts.length > 0 ? (
        <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
          {shoutouts.map((so, idx) => (
            <div
              key={so.id || idx}
              className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded font-mono font-black text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                  {so.room_code}
                </span>
                <span className="font-bold text-teal-300 shrink-0">{so.guest_name}:</span>
                <span className="text-zinc-200 truncate font-medium">"{so.message}"</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-500 font-mono">
                  {so.created_at ? new Date(so.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteShoutout(so.id)}
                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete shoutout"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 italic text-center py-3 bg-white/[0.01] rounded-xl border border-dashed border-white/5">
          No shoutouts broadcasted yet. Send a shoutout from any phone remote to see it live here!
        </p>
      )}
    </div>
  );
}

// ─── Panel: Song Catalog ──────────────────────────────────────────────────────
function SongsTab({ songs, totalCount, onRefresh }: { songs: Song[]; totalCount: number; onRefresh: () => void }) {
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;
    setSaving(true);
    try {
      const res = await fetch('/api/songs/' + editingSong.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSong),
      });
      if (res.ok) {
        setEditingSong(null);
        onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this song from the catalog?')) return;
    setDeletingId(id);
    try {
      await fetch('/api/songs/' + id, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.error('Delete song failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div
        className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[350px] overflow-hidden gap-3.5"
        style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Music2 size={15} className="text-indigo-400" />
            <span>Database Catalog ({totalCount} songs)</span>
          </h2>
          <Link
            href="/admin/songs/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
          >
            <Plus size={13} />
            <span>Add Song</span>
          </Link>
        </div>

        {/* Table — scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(18, 18, 28, 1)' }}>
              <tr className="border-b border-white/10 text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-2 font-bold">Code</th>
                <th className="py-3 px-2 font-bold">Title</th>
                <th className="py-3 px-2 font-bold">Artist</th>
                <th className="py-3 px-2 font-bold">Category</th>
                <th className="py-3 px-2 font-bold">Status</th>
                <th className="py-3 px-2 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {songs.map((song) => (
                <tr key={song.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 px-2 font-mono text-indigo-400 font-bold whitespace-nowrap">#{song.code}</td>
                  <td className="py-3 px-2 font-semibold text-white max-w-[180px] truncate">{song.title}</td>
                  <td className="py-3 px-2 text-slate-400 max-w-[120px] truncate">{song.artist}</td>
                  <td className="py-3 px-2 text-slate-500 whitespace-nowrap">{song.category ?? '—'}</td>
                  <td className="py-3 px-2 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        song.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      {song.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditingSong({ ...song })}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                        title="Edit song"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(song.id)}
                        disabled={deletingId === song.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                        title="Delete song"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {songs.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">No songs in the database yet.</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: 'rgba(18, 18, 28, 0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit size={15} className="text-indigo-400" />
                Edit Song
              </h3>
              <button
                onClick={() => setEditingSong(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              {([
                { field: 'title', label: 'Title' },
                { field: 'artist', label: 'Artist' },
                { field: 'code', label: 'Song Code' },
                { field: 'category', label: 'Category' },
                { field: 'language', label: 'Language' },
              ] as { field: keyof Song; label: string }[]).map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                  <input
                    type="text"
                    value={(editingSong[field] as string) ?? ''}
                    onChange={(e) => setEditingSong({ ...editingSong, [field]: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none placeholder-slate-600"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSong.is_active}
                    onChange={(e) => setEditingSong({ ...editingSong, is_active: e.target.checked })}
                    className="accent-indigo-500"
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSong(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Panel: Room Management ───────────────────────────────────────────────────
function RoomsTab({
  analytics,
  onKillRoom,
}: {
  analytics: AnalyticsData | null;
  onKillRoom: (roomCode: string) => Promise<void>;
}) {
  const [killing, setKilling] = useState<string | null>(null);
  const [killed, setKilled] = useState<string | null>(null);
  const [confirmKill, setConfirmKill] = useState<string | null>(null);
  const [previewRoom, setPreviewRoom] = useState<string | null>(null);

  const [inspectorView, setInspectorView] = useState<'tv' | 'remote'>('tv');
  const [filterCategory, setFilterCategory] = useState<'all' | 'online' | 'offline'>('all');
  const [killingAllOffline, setKillingAllOffline] = useState(false);

  const roomsList = analytics?.active_rooms_list || [];
  const onlineRooms = roomsList.filter((r) => r.is_online && r.user_count > 0);
  const offlineRooms = roomsList.filter((r) => !r.is_online || r.user_count === 0);

  const displayedRooms = roomsList.filter((r) => {
    const isRoomOnline = r.is_online && r.user_count > 0;
    if (filterCategory === 'online') return isRoomOnline;
    if (filterCategory === 'offline') return !isRoomOnline;
    return true;
  });

  const handleKillAllOffline = async () => {
    if (offlineRooms.length === 0) return;
    if (!window.confirm(`Are you sure you want to terminate ALL ${offlineRooms.length} offline/idle rooms? This will clear space immediately.`)) return;
    setKillingAllOffline(true);
    try {
      await fetch('/api/admin/rooms?kill_all_offline=true', { method: 'DELETE' });
      await onKillRoom('');
    } catch (e) {
      console.error('Failed to kill offline rooms:', e);
    } finally {
      setKillingAllOffline(false);
    }
  };

  const handleKill = async (roomCode: string) => {
    if (confirmKill !== roomCode) {
      setConfirmKill(roomCode);
      setTimeout(() => setConfirmKill(null), 4000);
      return;
    }
    setKilling(roomCode);
    setConfirmKill(null);
    try {
      await onKillRoom(roomCode);
      setKilled(roomCode);
      setTimeout(() => setKilled(null), 3000);
    } finally {
      setKilling(null);
    }
  };

  return (
    <div
      className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[420px] overflow-hidden gap-3.5"
      style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Tv size={16} className="text-green-400" />
            <span>Room Control Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor and manage all active karaoke room sessions in real time. Easily identify idle/unused rooms to clear space.
          </p>
        </div>
      </div>

      {/* Kill switch warning */}
      <div
        className="p-2.5 rounded-xl flex items-center gap-2 shrink-0"
        style={{ background: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.2)' }}
      >
        <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
        <p className="text-[11px] text-yellow-300">
          Killing a room immediately clears its song queue, disconnects remotes, and returns TV to standby to optimize Supabase database storage.
        </p>
      </div>

      {/* Category Filter Pills & Kill All Offline Button Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            All Rooms ({roomsList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('online')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterCategory === 'online'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online ({onlineRooms.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory('offline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterCategory === 'offline'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <AlertTriangle size={12} className="text-amber-300" />
            <span>Offline / Idle ({offlineRooms.length})</span>
          </button>
        </div>

        {offlineRooms.length > 0 && (
          <button
            type="button"
            onClick={handleKillAllOffline}
            disabled={killingAllOffline}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Trash2 size={13} className={killingAllOffline ? 'animate-spin' : ''} />
            <span>{killingAllOffline ? 'Terminating...' : `Kill All Offline (${offlineRooms.length})`}</span>
          </button>
        )}
      </div>

      {!displayedRooms.length ? (
        <div className="py-8 text-center my-auto">
          <Tv size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No rooms found in this category.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {displayedRooms.map((room) => {
            const isKilling = killing === room.room_code;
            const isKilled = killed === room.room_code;
            const isConfirming = confirmKill === room.room_code;
            const uptimeMs = Date.now() - new Date(room.created_at).getTime();
            const uptimeMin = Math.floor(uptimeMs / 60000);
            const uptimeStr = uptimeMin < 60
              ? `${uptimeMin}m uptime`
              : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m uptime`;

            const isIdle = !room.is_online || room.user_count === 0;

            return (
              <div
                key={room.id}
                className="p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                style={{
                  background: isKilled
                    ? 'rgba(239, 68, 68, 0.05)'
                    : isIdle
                    ? 'rgba(245, 158, 11, 0.03)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${
                    isKilled
                      ? 'rgba(239, 68, 68, 0.2)'
                      : isIdle
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(255, 255, 255, 0.06)'
                  }`,
                }}
              >
                <div className="flex items-start md:items-center gap-3.5 flex-1 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 md:mt-0"
                    style={{
                      background: isIdle ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      border: `1px solid ${isIdle ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    }}
                  >
                    <Tv size={20} className={isIdle ? 'text-amber-400' : 'text-green-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-lg font-black text-white font-mono tracking-widest">
                        {room.room_code}
                      </span>

                      {isKilled ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          TERMINATED
                        </span>
                      ) : isIdle ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <AlertTriangle size={12} className="inline text-amber-400" /> IDLE / OFFLINE (0 users)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          ONLINE ({room.user_count} users: {room.tv_count} TV, {room.remote_count} remotes)
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        <Globe size={11} className="text-indigo-400" />
                        {room.city}, {room.country}
                      </span>
                    </div>

                    {/* Song & Queue Info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs mt-1">
                      <div className="flex items-center gap-1.5 text-slate-200 truncate">
                        <Music2 size={12} className={room.currently_playing ? 'text-green-400 animate-pulse' : 'text-slate-500'} />
                        {room.currently_playing ? (
                          <span className="font-semibold text-green-300">
                            Now Playing: {room.currently_playing.title} <span className="text-slate-400 font-normal">by {room.currently_playing.artist}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No song currently playing</span>
                        )}
                      </div>

                      <span className="text-slate-600">•</span>

                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-medium text-indigo-300">{room.queue_count || 0} queued</span>
                        <span>·</span>
                        <span className="font-medium text-slate-300">{room.chat_count || 0} chats</span>
                      </div>
                    </div>

                    {/* Uptime footer */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {uptimeStr}
                      </span>
                      <span>Started {new Date(room.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => {
                      setInspectorView('tv');
                      setPreviewRoom(room.room_code);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-300 hover:text-white transition-colors flex items-center gap-1.5"
                    style={{ border: "1px solid rgba(99, 102, 241, 0.25)", background: "rgba(99, 102, 241, 0.1)" }}
                  >
                    <Tv size={13} />
                    Inspect Room
                  </button>

                  <button
                    onClick={() => handleKill(room.room_code)}
                    disabled={isKilling || isKilled}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: isConfirming
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${isConfirming ? 'rgba(239,68,68,0.6)' : 'rgba(239, 68, 68, 0.2)'}`,
                      color: isConfirming ? '#fca5a5' : '#ef4444',
                    }}
                  >
                    <Power size={12} />
                    <span>
                      {isKilling ? 'Terminating...' : isKilled ? 'Terminated' : isConfirming ? 'Confirm Kill?' : 'Kill Room'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Room Inspector Preview Modal (TV / Remote Views) */}
      {previewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div
            className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ height: '85vh', maxHeight: '720px' }}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-white/10 gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm font-black text-white font-mono tracking-wider">
                  ROOM INSPECTOR — {previewRoom}
                </span>

                {/* View Mode Switcher Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setInspectorView('tv')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      inspectorView === 'tv'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Tv size={13} />
                    TV Screen
                  </button>
                  <button
                    onClick={() => setInspectorView('remote')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      inspectorView === 'remote'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone size={13} />
                    Remote Control
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={inspectorView === 'tv' ? `/tv/${previewRoom}` : `/remote/${previewRoom}`}
                  target="_blank"
                  className="px-3 py-1.5 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-500/10 rounded-lg border border-indigo-500/20 flex items-center gap-1 transition-colors"
                >
                  Open {inspectorView === 'tv' ? 'TV' : 'Remote'} Fullscreen ↗
                </Link>
                <button
                  onClick={() => setPreviewRoom(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Iframe Content */}
            <iframe
              src={inspectorView === 'tv' ? `/tv/${previewRoom}` : `/remote/${previewRoom}`}
              className="w-full flex-1 border-0 bg-black"
              title={`Room ${previewRoom} ${inspectorView}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Feedbacks & Reports ────────────────────────────────────────────────
function FeedbacksTab() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'feedbacks' | 'live_chats'>('feedbacks');
  const [filter, setFilter] = useState<'all' | 'feedback' | 'bug' | 'song_request'>('all');

  const fetchFeedbacks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/feedbacks');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setFeedbacks(json.data);
      }
    } catch (err) {
      console.error('Failed to load feedbacks:', err);
    }
  }, []);

  const fetchSupportChats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support-chat');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSupportChats(json.data);
      }
    } catch (err) {
      console.error('Failed to load support chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchFeedbacks(), fetchSupportChats()]).finally(() => setLoading(false));

    const supabase = createClient();
    const channel = supabase
      .channel('admin_global_support_chats')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_support_chats',
        },
        (payload) => {
          const newMsg = payload.new;
          setSupportChats((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFeedbacks, fetchSupportChats]);

  const updateStatus = async (id: string, status: string) => {
    setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status: status as any } : f)));
    try {
      await fetch('/api/admin/feedbacks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
    } catch {
      fetchFeedbacks();
    }
  };

  const [activeChatFeedback, setActiveChatFeedback] = useState<FeedbackItem | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Fetch & Subscribe to selected feedback chat thread
  useEffect(() => {
    if (!activeChatFeedback) return;
    const targetSessionId = activeChatFeedback.session_id;
    const targetFeedbackId = activeChatFeedback.id;

    const url = targetSessionId
      ? `/api/admin/support-chat?session_id=${targetSessionId}`
      : `/api/admin/support-chat?feedback_id=${targetFeedbackId}`;

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setChatMessages(json.data);
        }
      })
      .catch(() => {});

    const supabase = createClient();
    const filterStr = targetSessionId ? `session_id=eq.${targetSessionId}` : `feedback_id=eq.${targetFeedbackId}`;

    const channel = supabase
      .channel(`admin_chat_thread:${targetFeedbackId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_support_chats',
          filter: filterStr,
        },
        (payload) => {
          const newMsg = payload.new;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatFeedback]);

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatFeedback || sendingChat) return;

    const msg = chatInput.trim();
    setChatInput('');
    setSendingChat(true);

    try {
      const res = await fetch('/api/admin/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeChatFeedback.session_id || 'ADMIN_DIRECT',
          feedback_id: activeChatFeedback.id,
          sender_type: 'admin',
          sender_name: 'Admin Support',
          message: msg,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === json.data.id)) return prev;
          return [...prev, json.data];
        });
      }
      fetchSupportChats();
    } catch (err) {
      console.error('Failed to send admin reply:', err);
    } finally {
      setSendingChat(false);
    }
  };

  const filtered = feedbacks.filter((f) => (filter === 'all' ? true : f.category === filter));

  return (
    <div
      className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[380px] overflow-hidden"
      style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSubTab('feedbacks')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'feedbacks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare size={14} />
              <span>Feedbacks &amp; Reports ({feedbacks.length})</span>
            </button>

            <button
              onClick={() => setSubTab('live_chats')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                subTab === 'live_chats'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send size={13} />
              <span>Live Support Chats ({supportChats.length})</span>
            </button>
          </div>
        </div>

        {/* Filter buttons for Feedbacks tab */}
        {subTab === 'feedbacks' && (
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {(['all', 'feedback', 'bug', 'song_request'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                  filter === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'song_request' ? 'Song Requests' : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          Loading messages...
        </div>
      ) : subTab === 'live_chats' ? (
        supportChats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Send size={24} className="text-slate-600" />
            <p>No active support chats yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {/* Group support chats by session_id or feedback_id */}
            {Array.from(new Set(supportChats.map((c) => c.session_id || c.feedback_id || c.id))).map((threadKey) => {
              const threadMsgs = supportChats.filter((c) => (c.session_id || c.feedback_id || c.id) === threadKey);
              const latestMsg = threadMsgs[threadMsgs.length - 1];
              const firstUserMsg = threadMsgs.find((m) => m.sender_type === 'user') || latestMsg;

              return (
                <div
                  key={threadKey}
                  className="p-4 rounded-xl flex items-center justify-between gap-3 transition-all"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {firstUserMsg?.sender_name || 'Guest User'}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                        Session: {threadKey}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-auto">
                        {new Date(latestMsg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-1">
                      <strong className="text-slate-400">{latestMsg.sender_name}:</strong> {latestMsg.message}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setActiveChatFeedback({
                        id: firstUserMsg.feedback_id || '',
                        session_id: firstUserMsg.session_id || threadKey,
                        category: 'feedback',
                        message: firstUserMsg.message,
                        guest_name: firstUserMsg.sender_name,
                        status: 'unread',
                        created_at: firstUserMsg.created_at,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <MessageSquare size={13} />
                    <span>Open Live Chat ({threadMsgs.length})</span>
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
          <MessageSquare size={24} className="text-slate-600" />
          <p>No feedbacks or reports found yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
              style={{
                background: item.status === 'unread' ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${item.status === 'unread' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
              }}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                      item.category === 'bug'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : item.category === 'song_request'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {item.category === 'song_request' ? (
                      <>
                        <Music2 size={11} />
                        <span>Song Request</span>
                      </>
                    ) : item.category === 'bug' ? (
                      <>
                        <AlertTriangle size={11} />
                        <span>Bug Report</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare size={11} />
                        <span>Feedback</span>
                      </>
                    )}
                  </span>

                  {item.guest_name && (
                    <span className="text-xs font-semibold text-white">
                      {item.guest_name}
                    </span>
                  )}

                  {item.room_code && (
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      Room: {item.room_code}
                    </span>
                  )}

                  <span className="text-[10px] text-slate-500 ml-auto">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {item.message}
                </p>
              </div>

              {/* Status & Chat Reply Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveChatFeedback(item)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-1"
                >
                  <MessageSquare size={12} />
                  <span>Reply Chat</span>
                </button>

                {item.status !== 'resolved' ? (
                  <button
                    onClick={() => updateStatus(item.id, 'resolved')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                  >
                    <CheckCircle size={12} />
                    <span>Resolve</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    ✓ Resolved
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Reply Chat Drawer/Modal */}
      {activeChatFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[500px] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Reply to {activeChatFeedback.guest_name || 'User'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Session: {activeChatFeedback.session_id || 'Anonymous'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveChatFeedback(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Initial Feedback Context */}
            <div className="p-3 bg-indigo-950/30 border-b border-indigo-900/40 text-xs text-indigo-200">
              <span className="font-bold text-indigo-400">Original Feedback:</span> "{activeChatFeedback.message}"
            </div>

            {/* Chat Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar bg-slate-950/40">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No conversation history yet. Send a message to start chatting!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isAdmin = msg.sender_type === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className={`text-[10px] font-bold ${isAdmin ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {isAdmin ? '🛡️ You (Admin)' : msg.sender_name}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                          isAdmin
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendAdminReply} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your response to the user..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Send size={13} />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Supabase Database Storage, Quota Monitoring & Live Audit Logs ───
interface SupabaseStatsResponse {
  database: {
    usedBytes: number;
    usedMb: number;
    quotaMb: number;
    quotaBytes: number;
    percentageUsed: number;
    totalRows: number;
    status: 'Healthy' | 'Warning';
  };
  storage: {
    usedBytes: number;
    usedMb: number;
    quotaMb: number;
    quotaBytes: number;
    percentageUsed: number;
    status: 'Healthy' | 'Warning';
  };
  tables: Array<{
    id: string;
    name: string;
    desc: string;
    rowCount: number;
    estimatedSizeBytes: number;
  }>;
  timestamp: string;
}

function SupabaseStatsTab() {
  const [stats, setStats] = useState<SupabaseStatsResponse | null>(null);
  const [logs, setLogs] = useState<Array<{
    id: string;
    room_code: string;
    action: string;
    guest_session_id: string;
    metadata?: any;
    created_at: string;
  }>>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [purgingTable, setPurgingTable] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/supabase-stats');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      }
    } catch (e) {
      console.error('Error fetching Supabase storage stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setLogs(json.data);
        }
      }
    } catch (e) {
      console.warn('Error fetching reservation logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLogs();
  }, [fetchStats, fetchLogs]);

  const handlePurgeTable = async (tableName: string, label: string) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to PURGE ALL DATA from table '${label}' (${tableName}) in Supabase? This action cannot be undone.`)) return;
    setPurgingTable(tableName);
    try {
      const res = await fetch('/api/admin/tables/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName }),
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(`Successfully cleared table '${label}'!`);
        if (tableName === 'reservation_logs') setLogs([]);
        fetchStats();
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert(`Failed to clear table: ${json.error?.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Error purging table:', e);
      alert('Network error while clearing table.');
    } finally {
      setPurgingTable(null);
    }
  };

  const handleDeleteSingleLog = async (id: string) => {
    setLogs((prev) => prev.filter((item) => item.id !== id));
    try {
      await fetch(`/api/admin/logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      fetchStats();
    } catch (e) {
      console.error('Error deleting log item:', e);
    }
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all reservation logs?')) return;
    setLogs([]);
    try {
      await fetch('/api/admin/logs?all=true', { method: 'DELETE' });
      setToastMessage('Reservation audit logs cleared successfully!');
      fetchStats();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (e) {
      console.error('Error clearing reservation logs:', e);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <HardDrive size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Supabase Quota, Storage & Database Manager</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                500MB DB Limit & 1GB Bucket Limit
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time monitoring of your Supabase database size, bucket storage, table purges & reservation audit logs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { fetchStats(); fetchLogs(); }}
          disabled={loadingStats || loadingLogs}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={(loadingStats || loadingLogs) ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Quota Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Database Storage (500 MB) */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database size={14} className="text-indigo-400" />
              <span>PostgreSQL DB Storage</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {stats?.database.status || 'Healthy'}
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {stats ? stats.database.usedMb : '0.00'} <span className="text-xs font-medium text-slate-400">MB</span>
              </span>
              <span className="text-xs font-mono text-slate-400">
                / {stats ? stats.database.quotaMb : 500} MB Limit
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400"
                style={{ width: `${Math.max(2, stats?.database.percentageUsed || 0)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>{stats ? `${stats.database.percentageUsed}% of 500 MB used` : 'Calculating usage...'}</span>
              <span>Available: {stats ? (stats.database.quotaMb - stats.database.usedMb).toFixed(2) : 500} MB</span>
            </p>
          </div>
        </div>

        {/* Card 2: Storage Bucket (1 GB / 1000 MB) */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon size={14} className="text-pink-400" />
              <span>Storage Bucket (Media & Assets)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {stats?.storage.status || 'Healthy'}
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {stats ? stats.storage.usedMb : '0.00'} <span className="text-xs font-medium text-slate-400">MB</span>
              </span>
              <span className="text-xs font-mono text-slate-400">
                / {stats ? stats.storage.quotaMb : 1000} MB (1GB) Limit
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-pink-500 to-rose-400"
                style={{ width: `${Math.max(2, stats?.storage.percentageUsed || 0)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex justify-between">
              <span>{stats ? `${stats.storage.percentageUsed}% of 1 GB used` : 'Calculating bucket...'}</span>
              <span>Available: {stats ? (stats.storage.quotaMb - stats.storage.usedMb).toFixed(2) : 1000} MB</span>
            </p>
          </div>
        </div>

        {/* Card 3: Total Managed Database Rows */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server size={14} className="text-teal-400" />
              <span>Total Database Rows</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-zinc-800">
              {stats?.tables.length || 8} Tables
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {stats ? stats.database.totalRows.toLocaleString() : '0'} <span className="text-xs font-medium text-slate-400">records</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Includes songs, queues, chats, shoutouts, system audit logs, user feedbacks, instances & registered devices.
            </p>
          </div>
        </div>
      </div>

      {/* Database Tables Usage & Purge Manager */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <PieChart size={15} className="text-indigo-400" />
              <span>Managed Tables Storage Breakdown & Quick Clear</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              View row counts and estimated disk usage per table. Select &quot;Clear Table&quot; to free database space instantly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {stats?.tables.map((table) => {
            const isPurging = purgingTable === table.id;
            return (
              <div
                key={table.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between gap-2.5 transition-all hover:border-white/10"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white truncate">{table.name}</h4>
                    <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 shrink-0">
                      {table.rowCount} rows
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-snug">{table.desc}</p>
                  <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-slate-500 border-t border-white/5">
                    <span>Table: {table.id}</span>
                    <span>~{formatBytes(table.estimatedSizeBytes)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePurgeTable(table.id, table.name)}
                  disabled={isPurging}
                  className="w-full py-1.5 px-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={11} className={isPurging ? 'animate-spin' : ''} />
                  <span>{isPurging ? 'Clearing...' : 'Clear Table'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Reservation Logs Table Monitor */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-indigo-400" />
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Reservation Audit Logs (reservation_logs)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-[10px] text-slate-400">Live reservation history & activity events ({logs.length} logs)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              className="p-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all text-[11px] font-bold flex items-center gap-1"
            >
              <RefreshCw size={11} className={loadingLogs ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllLogs}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Trash2 size={11} />
                <span>Clear Audit Logs</span>
              </button>
            )}
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="max-h-[260px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded font-mono font-black text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Room: {log.room_code}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.metadata && (
                    <p className="text-[11px] text-slate-300 truncate">
                      {log.metadata.title ? (
                        <span>
                          <strong className="text-white">{log.metadata.title}</strong> by {log.metadata.artist || 'Unknown'}
                        </span>
                      ) : (
                        JSON.stringify(log.metadata)
                      )}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSingleLog(log.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Delete log entry"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs rounded-xl bg-white/[0.01] border border-white/5">
            No reservation audit logs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [banner, setBanner] = useState<BannerSettings>({
    banner_enabled: false,
    banner_text: '',
    banner_image_url: '',
    banner_speed: 20,
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [totalSongsCount, setTotalSongsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSaveSuccess, setBannerSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  // Check auth via Supabase session
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          router.push('/admin/admin/admin/admin/admin/login');
        }
      });
    });
  }, [router]);

  const bannerIsDirtyRef = useRef(false);

  // Helper to update banner state & mark form as user-edited
  const updateBanner = (newSettings: BannerSettings) => {
    bannerIsDirtyRef.current = true;
    setBanner(newSettings);
  };

  // Fetch all data — called manually via Refresh button or on mount.
  // Auto-polling removed to prevent Vercel Fluid Active CPU overages.
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    try {
      const [analyticsRes, settingsRes, songsRes] = await Promise.all([
        fetch('/api/admin/analytics').catch(() => null),
        fetch('/api/admin/settings').catch(() => null),
        fetch('/api/songs?limit=500&include_inactive=true').catch(() => null),
      ]);

      const analyticsJson = analyticsRes && analyticsRes.ok ? await analyticsRes.json().catch(() => null) : null;
      const settingsJson = settingsRes && settingsRes.ok ? await settingsRes.json().catch(() => null) : null;
      const songsJson = songsRes && songsRes.ok ? await songsRes.json().catch(() => null) : null;

      if (analyticsJson?.success) setAnalytics(analyticsJson.data);
      // Only update banner state if user is NOT currently editing the form
      if (settingsJson?.success && !bannerIsDirtyRef.current) {
        setBanner(settingsJson.data);
      }
      if (songsJson?.success) {
        setSongs(songsJson.data.songs);
        setTotalSongsCount(songsJson.data.total);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('Dashboard fetch interrupted:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load only — NO auto-polling to avoid Vercel CPU quota overages.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Banner
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    setBannerSaveSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banner),
      });
      const json = await res.json();
      if (json.success) {
        bannerIsDirtyRef.current = false; // Reset dirty flag on save success
        setBannerSaveSuccess(true);
        setTimeout(() => setBannerSaveSuccess(false), 4000);
      }
    } finally {
      setSavingBanner(false);
    }
  };

  // Kill Room
  const handleKillRoom = async (roomCode: string) => {
    const codeUpper = roomCode.trim().toUpperCase();

    // 1. Optimistic UI update — remove room & its devices immediately from state
    setAnalytics((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          active_rooms: Math.max(0, prev.metrics.active_rooms - 1),
        },
        active_rooms_list: prev.active_rooms_list.filter(
          (r) => r.room_code.toUpperCase() !== codeUpper
        ),
        online_devices_list: prev.online_devices_list.filter(
          (d) => d.room_code.toUpperCase() !== codeUpper
        ),
      };
    });

    try {
      await fetch(`/api/admin/rooms?room_code=${encodeURIComponent(codeUpper)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to kill room:', err);
    }
    fetchData(true);
  };

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem('okekaraoke_admin_auth');
    router.push('/admin/admin/admin/admin/admin/login');
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4" style={{ background: 'var(--color-bg)' }}>
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm tracking-wider">LOADING DASHBOARD...</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Live Overview', icon: Layers },
    { id: 'rooms', label: 'Room Control', icon: Tv },
    { id: 'banner', label: 'Announcement', icon: Radio },
    { id: 'songs', label: 'Song Catalog', icon: Music2 },
    { id: 'feedbacks', label: 'Feedbacks & Reports', icon: MessageSquare },
    { id: 'supabase_stats', label: 'Supabase & Audit Logs', icon: HardDrive },
  ];

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between shrink-0 sticky top-0 z-40"
        style={{ background: 'rgba(8, 8, 15, 0.96)', borderBottom: '1px solid rgba(255, 255, 255, 0.07)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center p-1"
            style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/okekaraokelogo.png" alt="OKEKARAOKE" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              OKEKARAOKE ADMIN
            </h1>
            <p className="text-[10px] text-slate-500">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: isRefreshing ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: isRefreshing ? '#a78bfa' : '#94a3b8',
            }}
            title="Refresh analytics & settings data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4 lg:space-y-5 flex flex-col overflow-hidden">

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Active Rooms"
            value={analytics?.metrics.active_rooms ?? 0}
            icon={Tv}
            color="#22c55e"
            desc="Running TV Sessions"
          />
          <MetricCard
            label="Online Remotes"
            value={analytics?.metrics.online_remotes ?? analytics?.metrics.online_devices ?? 0}
            icon={Users}
            color="#6366f1"
            desc="Connected Phones"
          />
          <MetricCard
            label="Song Catalog"
            value={analytics?.metrics.total_songs ?? totalSongsCount}
            icon={Music2}
            color="#a78bfa"
            desc="Available Tracks"
          />
          <MetricCard
            label="Plays Today"
            value={analytics?.metrics.reservations_today ?? 0}
            icon={TrendingUp}
            color="#f59e0b"
            desc="Songs Reserved Today"
          />
        </div>


        {/* Tabs Navigation Bar */}
        <div className="flex border-b border-white/10 overflow-x-auto shrink-0" role="tablist">
          {tabs.map(({ id, label, icon }) => (
            <TabButton
              key={id}
              active={activeTab === id}
              onClick={() => setActiveTab(id)}
              icon={icon}
              label={label}
            />
          ))}
        </div>

        {/* Tab Panels Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-2 space-y-4">
          {activeTab === 'overview' && <OverviewTab analytics={analytics} onRefresh={() => fetchData()} loading={loading} />}
          {activeTab === 'rooms' && (
            <RoomsTab analytics={analytics} onKillRoom={handleKillRoom} />
          )}
          {activeTab === 'banner' && (
            <BannerTab
              banner={banner}
              setBanner={updateBanner}
              onSave={handleSaveBanner}
              saving={savingBanner}
              saved={bannerSaveSuccess}
            />
          )}
          {activeTab === 'songs' && (
            <SongsTab songs={songs} totalCount={totalSongsCount} onRefresh={fetchData} />
          )}
          {activeTab === 'feedbacks' && <FeedbacksTab />}
          {activeTab === 'supabase_stats' && <SupabaseStatsTab />}
        </div>
      </div>
    </div>
  );
}
