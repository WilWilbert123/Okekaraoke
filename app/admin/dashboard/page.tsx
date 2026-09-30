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
} from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
  metrics: {
    active_rooms: number;
    online_devices: number;
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
  banner_text: string;
  banner_image_url: string;
  banner_speed: number;
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

type Tab = 'overview' | 'banner' | 'songs' | 'rooms';

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
function OverviewTab({ analytics }: { analytics: AnalyticsData | null }) {
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
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-green-400 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
            REALTIME
          </span>
        </div>

        {!analytics?.active_rooms_list.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No active TV rooms right now.</p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {analytics.active_rooms_list.map((room) => (
              <div
                key={room.id}
                className="p-3.5 rounded-xl flex items-center justify-between transition-all"
                style={{
                  background: room.is_online ? 'rgba(34, 197, 94, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${room.is_online ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)'}`,
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
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
                      room.is_online
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}
                  >
                    {room.is_online ? '● LIVE ONLINE' : 'IDLE'}
                  </span>
                </div>
              </div>
            ))}
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
              Connected Devices ({analytics?.online_devices_list.length ?? 0})
            </h2>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            REALTIME
          </span>
        </div>

        {!analytics?.online_devices_list.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No devices currently connected.</p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {analytics.online_devices_list.map((dev) => (
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
  return (
    <div
      className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[350px] overflow-y-auto custom-scrollbar gap-4"
      style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Radio size={17} className="text-indigo-400" />
          <span>Live TV Announcement Banner</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Broadcast a running text ticker or advertisement banner on all active TV screens in real-time.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Left Column: Toggle & Announcement Text */}
          <div className="space-y-4">
            {/* Enable toggle */}
            <div
              className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer select-none"
              style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
              onClick={() => setBanner({ ...banner, banner_enabled: !banner.banner_enabled })}
            >
              <div>
                <p className="text-xs font-bold text-white">Enable TV Banner</p>
                <p className="text-[11px] text-slate-500">Show running text/image banner on all active TV screens</p>
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

            {/* Banner text */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Announcement Text (Running Ticker)
              </label>
              <input
                type="text"
                value={banner.banner_text}
                onChange={(e) => setBanner({ ...banner, banner_text: e.target.value })}
                placeholder="e.g. Welcome to OKEKARAOKE! Special promo: 20% off drinks tonight."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white outline-none transition-all placeholder-slate-600"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              />
            </div>
          </div>

          {/* Right Column: Image URL & Scroll Speed */}
          <div className="space-y-4">
            {/* Banner image URL */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={13} />
                <span>Advertisement Banner Image URL (Optional)</span>
              </label>
              <input
                type="url"
                value={banner.banner_image_url}
                onChange={(e) => setBanner({ ...banner, banner_image_url: e.target.value })}
                placeholder="https://example.com/banner.png"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white outline-none transition-all placeholder-slate-600 font-mono"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              />
            </div>

            {/* Scroll speed */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Scroll Speed: <span className="text-indigo-300">{banner.banner_speed}s</span>
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
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all active:scale-95 disabled:opacity-50 mt-2"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
        >
          {saving ? 'Publishing Live...' : 'Save & Broadcast to All TV Screens'}
        </button>
      </form>
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

      {!analytics?.active_rooms_list.length ? (
        <div className="py-8 text-center my-auto">
          <Tv size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No active rooms right now.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {analytics.active_rooms_list.map((room) => {
            const isKilling = killing === room.room_code;
            const isKilled = killed === room.room_code;
            const isConfirming = confirmKill === room.room_code;
            const uptimeMs = Date.now() - new Date(room.created_at).getTime();
            const uptimeMin = Math.floor(uptimeMs / 60000);
            const uptimeStr = uptimeMin < 60
              ? `${uptimeMin}m uptime`
              : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m uptime`;

            const isIdle = !room.is_online && room.user_count === 0 && !room.currently_playing && (room.queue_count || 0) === 0;

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
                          ⚠️ IDLE / UNUSED
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

  // Fetch all data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analyticsRes, settingsRes, songsRes] = await Promise.all([
        fetch('/api/admin/analytics').catch(() => null),
        fetch('/api/admin/settings').catch(() => null),
        fetch('/api/songs?limit=20&include_inactive=true').catch(() => null),
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
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 4_000);
    return () => clearInterval(interval);
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
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
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
            value={analytics?.metrics.online_devices ?? 0}
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


        {/* Tabs */}
        <div className="flex border-b border-white/10 overflow-x-auto" role="tablist">
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

        {/* Tab Panels */}
        {activeTab === 'overview' && <OverviewTab analytics={analytics} />}
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
      </div>
    </div>
  );
}
