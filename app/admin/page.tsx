// ============================================================
// OKEKARAOKE — Admin Dashboard
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import { Settings, Music2, ListMusic, Home, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface Song {
  id: string;
  code: string;
  title: string;
  artist: string;
  category: string | null;
  language: string | null;
  is_active: boolean;
}

export default function AdminPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/songs?page=${page}&limit=${LIMIT}&include_inactive=true`);
      const json = await res.json();
      if (json.success) {
        setSongs(json.data.songs);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSongs(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-indigo-400" />
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            OKEKARAOKE Admin
          </h1>
        </div>
        <Link href="/" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
          <Home size={14} />
          Home
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Songs', value: total, icon: Music2, color: '#6366f1' },
            { label: 'Active Songs', value: songs.filter(s => s.is_active).length, icon: ListMusic, color: '#22c55e' },
            { label: 'Inactive', value: songs.filter(s => !s.is_active).length, icon: Settings, color: '#f59e0b' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} style={{ color }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
              <p className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Songs Table */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-bold text-white">Song Catalog</h2>
            <div className="flex gap-2">
              <button
                onClick={fetchSongs}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <Link
                href="/admin/songs/new"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
              >
                <Plus size={14} />
                Add Song
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Code', 'Title', 'Artist', 'Category', 'Language', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr
                      key={song.id}
                      className="border-t transition-colors hover:bg-white/2"
                      style={{ borderColor: 'var(--color-border-subtle)' }}
                    >
                      <td className="px-4 py-3 font-mono text-slate-400">#{song.code}</td>
                      <td className="px-4 py-3 font-medium text-white">{song.title}</td>
                      <td className="px-4 py-3 text-slate-400">{song.artist}</td>
                      <td className="px-4 py-3 text-slate-500">{song.category ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{song.language ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{
                            background: song.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                            color: song.is_active ? '#22c55e' : '#64748b',
                          }}
                        >
                          {song.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-sm text-slate-500">
                Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * LIMIT >= total}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* YouTube Search Section */}
        <div className="glass rounded-xl p-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <ChevronRight size={16} className="text-indigo-400" />
            YouTube Search (Admin)
          </h2>
          <p className="text-sm text-slate-500">
            Use the YouTube search to find karaoke videos and add them to your catalog.
            Navigate to <Link href="/admin/songs/new" className="text-indigo-400 hover:underline">Add Song</Link> to search and link YouTube videos.
          </p>
        </div>
      </div>
    </div>
  );
}
