'use client';

// ============================================================
// OKEKARAOKE — Master Admin Dashboard
// Professional, icon-based, real-time control system
// ============================================================

import { useState, useEffect, useCallback } from 'react';
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
  }>;
  online_devices_list: Array<{
    id: string;
    device_type: string;
    device_name: string;
    is_online: boolean;
    last_seen_at: string;
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
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Tv size={15} className="text-green-400" />
          <h2 className="text-sm font-bold text-white">Active TV Rooms ({analytics?.active_rooms_list.length ?? 0})</h2>
        </div>
        {!analytics?.active_rooms_list.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No active TV rooms right now.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {analytics.active_rooms_list.map((room) => (
              <div
                key={room.id}
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}
              >
                <div>
                  <span className="text-sm font-black text-white font-mono tracking-wider">
                    ROOM {room.room_code}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} className="text-slate-600" />
                    <p className="text-[11px] text-slate-500">
                      {new Date(room.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                  LIVE
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Remotes */}
      <div
        className="p-5 rounded-2xl flex flex-col h-full overflow-hidden"
        style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Smartphone size={15} className="text-indigo-400" />
          <h2 className="text-sm font-bold text-white">
            Connected Remotes ({analytics?.online_devices_list.length ?? 0})
          </h2>
        </div>
        {!analytics?.online_devices_list.length ? (
          <p className="text-xs text-slate-500 py-8 text-center my-auto">No remotes currently connected.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {analytics.online_devices_list.map((dev) => (
              <div
                key={dev.id}
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold text-white">{dev.device_name || 'Guest Remote'}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{dev.id.slice(0, 12)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {dev.is_online ? (
                    <Wifi size={12} className="text-green-400" />
                  ) : (
                    <WifiOff size={12} className="text-slate-600" />
                  )}
                  <span className="text-xs font-semibold text-slate-400 uppercase">{dev.device_type}</span>
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
      className="p-5 rounded-2xl flex flex-col h-[calc(100vh-380px)] min-h-[350px] overflow-hidden gap-3.5"
      style={{ background: 'rgba(18, 18, 28, 0.8)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
    >
      <div className="shrink-0">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Tv size={16} className="text-green-400" />
          <span>Room Control Center</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Monitor and manage all active karaoke room sessions. Use the kill switch to immediately terminate a room.
        </p>
      </div>

      {/* Kill switch warning */}
      <div
        className="p-2.5 rounded-xl flex items-center gap-2 shrink-0"
        style={{ background: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.2)' }}
      >
        <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
        <p className="text-[11px] text-yellow-300">
          Killing a room immediately clears its song queue, disconnects remotes, and returns TV to standby.
        </p>
      </div>

      {!analytics?.active_rooms_list.length ? (
        <div className="py-8 text-center my-auto">
          <Tv size={32} className="text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No active rooms right now.</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
          {analytics.active_rooms_list.map((room) => {
            const isKilling = killing === room.room_code;
            const isKilled = killed === room.room_code;
            const isConfirming = confirmKill === room.room_code;
            const uptimeMs = Date.now() - new Date(room.created_at).getTime();
            const uptimeMin = Math.floor(uptimeMs / 60000);
            const uptimeStr = uptimeMin < 60
              ? `${uptimeMin}m uptime`
              : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m uptime`;

            return (
              <div
                key={room.id}
                className="p-4 rounded-2xl flex items-center justify-between gap-4"
                style={{
                  background: isKilled
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isKilled ? 'rgba(239,68,68,0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                  >
                    <Tv size={18} className="text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white font-mono tracking-widest">
                        {room.room_code}
                      </span>
                      {isKilled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          TERMINATED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {uptimeStr}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Started {new Date(room.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPreviewRoom(room.room_code)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors"
                    style={{ border: "1px solid rgba(99, 102, 241, 0.2)", background: "rgba(99, 102, 241, 0.06)" }}
                  >
                    View TV
                  </button>

                  <button
                    onClick={() => handleKill(room.room_code)}
                    disabled={isKilling || isKilled}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      background: isConfirming
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${isConfirming ? 'rgba(239,68,68,0.5)' : 'rgba(239, 68, 68, 0.2)'}`,
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

      {/* TV Preview Modal */}
      {previewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ height: '75vh', maxHeight: '600px' }}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-bold text-white font-mono tracking-wider">
                  LIVE PREVIEW — ROOM {previewRoom}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/tv/${previewRoom}`}
                  target="_blank"
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-500/10 rounded-lg border border-indigo-500/20"
                >
                  Open Fullscreen ↗
                </Link>
                <button
                  onClick={() => setPreviewRoom(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe
              src={`/tv/${previewRoom}`}
              className="w-full flex-1 border-0 bg-black"
              title="Live TV Preview"
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
      if (settingsJson?.success) setBanner(settingsJson.data);
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
    const interval = setInterval(() => fetchData(true), 10_000);
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
        setBannerSaveSuccess(true);
        setTimeout(() => setBannerSaveSuccess(false), 4000);
      }
    } finally {
      setSavingBanner(false);
    }
  };

  // Kill Room
  const handleKillRoom = async (roomCode: string) => {
    // 1. Optimistic UI update
    setAnalytics((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metrics: {
          ...prev.metrics,
          active_rooms: Math.max(0, prev.metrics.active_rooms - 1),
        },
        active_rooms_list: prev.active_rooms_list.filter(
          (r) => r.room_code.toUpperCase() !== roomCode.toUpperCase()
        ),
      };
    });

    try {
      await fetch(`/api/admin/rooms?room_code=${roomCode}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to kill room:', err);
    }
    setTimeout(() => fetchData(true), 1000);
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
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
          >
            <ShieldCheck size={19} className="text-indigo-400" />
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
            setBanner={setBanner}
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
