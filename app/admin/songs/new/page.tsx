'use client';

// ============================================================
// OKEKARAOKE — Add/Edit Song Page (Admin)
// YouTube search + song catalog management
// ============================================================

import { useState } from 'react';
import { Search, Play, Plus, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface YouTubeResult {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
}

export default function NewSongPage() {
  const [ytQuery, setYtQuery] = useState('');
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeResult | null>(null);

  const [form, setForm] = useState({
    code: '',
    title: '',
    artist: '',
    category: '',
    language: '',
    song_type: '',
    keywords: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const searchYouTube = async () => {
    if (!ytQuery.trim()) return;
    setYtLoading(true);
    setYtResults([]);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(ytQuery)}`);
      const json = await res.json();
      if (json.success) {
        setYtResults(json.data.results ?? []);
      }
    } finally {
      setYtLoading(false);
    }
  };

  const handleSelectVideo = (video: YouTubeResult) => {
    setSelectedVideo(video);
    // Pre-fill form from video title
    if (!form.title) {
      setForm((prev) => ({
        ...prev,
        title: video.title.replace(/ karaoke.*/i, '').replace(/ minus one.*/i, '').trim(),
      }));
    }
  };

  const handleSave = async () => {
    if (!form.code || !form.title || !form.artist) {
      setSaveError('Code, title, and artist are required.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          title: form.title,
          artist: form.artist,
          youtube_video_id: selectedVideo?.video_id ?? null,
          thumbnail_url: selectedVideo?.thumbnail_url ?? null,
          category: form.category || null,
          language: form.language || null,
          song_type: form.song_type || null,
          keywords: form.keywords ? form.keywords.split(',').map((k) => k.trim()) : [],
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1500);
      } else {
        setSaveError(json.error?.message ?? 'Failed to save song.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      <header
        className="px-6 py-4 flex items-center gap-4"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <Link href="/admin" className="text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Add New Song
        </h1>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* YouTube Search */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Search size={16} className="text-indigo-400" />
            Search YouTube
          </h2>

          <div className="flex gap-2">
            <input
              value={ytQuery}
              onChange={(e) => setYtQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
              placeholder="e.g. Harana karaoke minus one"
              className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            />
            <button
              onClick={searchYouTube}
              disabled={ytLoading}
              className="px-4 py-2.5 rounded-xl font-semibold text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
            >
              {ytLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          {/* Results */}
          {ytResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-2">Select the correct video — do NOT automatically pick the first result</p>
              {ytResults.map((video) => (
                <div
                  key={video.video_id}
                  onClick={() => handleSelectVideo(video)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: selectedVideo?.video_id === video.video_id
                      ? 'rgba(99, 102, 241, 0.12)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${selectedVideo?.video_id === video.video_id
                      ? 'rgba(99, 102, 241, 0.4)'
                      : 'rgba(255, 255, 255, 0.05)'}`,
                  }}
                >
                  {video.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="w-16 h-12 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{video.title}</p>
                    <p className="text-xs text-slate-500 truncate">{video.channel_title}</p>
                  </div>
                  {selectedVideo?.video_id === video.video_id && (
                    <CheckCircle size={16} className="text-indigo-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedVideo && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
            >
              <Play size={14} className="text-indigo-400 fill-indigo-400" />
              <span className="text-sm text-indigo-300 font-medium">Selected: {selectedVideo.title}</span>
              <span className="text-xs text-slate-500 font-mono ml-auto">{selectedVideo.video_id}</span>
            </div>
          )}
        </div>

        {/* Song Form */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h2 className="font-bold text-white">Song Details</h2>

          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'code', label: 'Song Code', placeholder: '5492', required: true },
              { key: 'title', label: 'Title', placeholder: 'Harana', required: true },
              { key: 'artist', label: 'Artist', placeholder: 'Parokya ni Edgar', required: true },
              { key: 'keywords', label: 'Keywords (comma-separated)', placeholder: 'harana, parokya, opm' },
            ].map(({ key, label, placeholder, required }) => (
              <div key={key} className={key === 'keywords' ? 'col-span-2' : ''}>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                  {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                />
              </div>
            ))}

            {[
              { key: 'category', label: 'Category', options: ['OPM', 'English', 'Korean', 'Japanese', 'Chinese', 'Pop', 'Rock', 'Classic', 'Love Songs', 'Dance', 'Christmas', 'Oldies'] },
              { key: 'language', label: 'Language', options: ['Filipino', 'English', 'Korean', 'Japanese', 'Chinese', 'Spanish'] },
              { key: 'song_type', label: 'Song Type', options: ['Karaoke', 'Minus One', 'Duet', 'Male Vocal', 'Female Vocal', 'Band'] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
                <select
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                >
                  <option value="">Select...</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertCircle size={14} className="text-red-400" />
              <span className="text-sm text-red-300">{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-sm text-green-300">Song saved! Redirecting...</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || saveSuccess}
            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? 'Saving...' : 'Add Song to Catalog'}
          </button>
        </div>
      </div>
    </div>
  );
}
