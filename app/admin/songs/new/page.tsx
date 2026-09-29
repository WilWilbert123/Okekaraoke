'use client';

// ============================================================
// OKEKARAOKE — Add Song Page (Admin)
// Full-screen split layout: search left, form right.
// No page-level scroll — everything fits the viewport.
// ============================================================

import { useState } from 'react';
import {
  Search, Play, Plus, ArrowLeft, CheckCircle,
  AlertCircle, Loader2, Video, Music2,
} from 'lucide-react';
import Link from 'next/link';

interface YouTubeResult {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
}

export default function NewSongPage() {
  const [ytQuery, setYtQuery]       = useState('');
  const [ytResults, setYtResults]   = useState<YouTubeResult[]>([]);
  const [ytLoading, setYtLoading]   = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeResult | null>(null);
  const [ytUrl, setYtUrl]           = useState('');

  const [form, setForm] = useState({
    code: '', title: '', artist: '',
    category: '', language: '', song_type: '', keywords: '',
  });

  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── YouTube search ───────────────────────────────────────────
  const searchYouTube = async () => {
    if (!ytQuery.trim()) return;
    setYtLoading(true);
    setYtResults([]);
    try {
      const res  = await fetch(`/api/youtube/search?q=${encodeURIComponent(ytQuery)}`);
      const json = await res.json();
      if (json.success) setYtResults(json.data.results ?? []);
    } finally {
      setYtLoading(false);
    }
  };

  // ── Pick a result → auto-fill form ──────────────────────────
  const handleSelectVideo = (video: YouTubeResult) => {
    setSelectedVideo(video);
    const titleMatch = video.title.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*[(\[].+)?$/);
    const autoTitle  = titleMatch
      ? titleMatch[1].trim()
      : video.title.replace(/\s*[(\[].*$/g, '').trim();
    const autoArtist = titleMatch
      ? titleMatch[2].replace(/\s*(karaoke|instrumental|minus one|hd|hq|official|version|lyrics|acoustic|piano|full band).*/i, '').trim()
      : '';
    setForm((prev) => ({
      ...prev,
      title:  prev.title  || autoTitle,
      artist: prev.artist || autoArtist || video.channel_title,
    }));
  };

  // ── Direct URL paste ─────────────────────────────────────────
  const handleUrlPaste = (val: string) => {
    setYtUrl(val);
    const match = val.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const vid   = match ? match[1] : (val.length === 11 ? val : null);
    if (vid) {
      setSelectedVideo({
        video_id:      vid,
        title:         'Direct Link Video',
        channel_title: 'YouTube',
        thumbnail_url: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        published_at:  '',
      });
    }
  };

  // ── Save to catalog ──────────────────────────────────────────
  const handleSave = async () => {
    if (!form.code || !form.title || !form.artist) {
      setSaveError('Code, title, and artist are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res  = await fetch('/api/songs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code:             form.code,
          title:            form.title,
          artist:           form.artist,
          youtube_video_id: selectedVideo?.video_id ?? null,
          thumbnail_url:    selectedVideo?.thumbnail_url ?? null,
          category:         form.category  || null,
          language:         form.language  || null,
          song_type:        form.song_type || null,
          keywords:         form.keywords
            ? form.keywords.split(',').map((k) => k.trim())
            : [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        setTimeout(() => { window.location.href = '/admin'; }, 1400);
      } else {
        setSaveError(json.error?.message ?? 'Failed to save song.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* ── Top bar ── */}
      <header
        className="flex items-center gap-4 px-5 py-3 shrink-0"
        style={{
          background:   'rgba(8,8,15,0.96)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Link
          href="/admin"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <Music2 size={14} className="text-indigo-400" />
          </div>
          <h1
            className="text-sm font-black text-white tracking-wide"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Add Song to Catalog
          </h1>
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* ══ LEFT — YouTube Search ══ */}
        <div
          className="flex flex-col w-[55%] border-r overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {/* Search controls — fixed */}
          <div
            className="shrink-0 p-4 space-y-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Direct URL input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Video size={12} className="text-red-400" />
                Direct YouTube Link or Video ID
              </label>
              <input
                value={ytUrl}
                onChange={(e) => handleUrlPaste(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                className="w-full px-3 py-2 rounded-xl text-white placeholder-slate-600 text-xs font-mono outline-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              <span className="h-px flex-1 bg-white/8" />
              <span>or search youtube</span>
              <span className="h-px flex-1 bg-white/8" />
            </div>

            {/* Search bar */}
            <div className="flex gap-2">
              <input
                value={ytQuery}
                onChange={(e) => setYtQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
                placeholder="e.g. Harana karaoke minus one"
                className="flex-1 px-3.5 py-2 rounded-xl text-white placeholder-slate-600 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                onClick={searchYouTube}
                disabled={ytLoading}
                className="px-4 py-2 rounded-xl font-bold text-white text-sm flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all shrink-0"
                style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
              >
                {ytLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </div>
          </div>

          {/* Results list — scrollable */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {!ytResults.length && !ytLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-2 pb-8">
                <Video size={32} className="text-slate-700" />
                <p className="text-xs text-slate-600">Search to find a video</p>
              </div>
            )}
            {ytLoading && (
              <div className="flex items-center justify-center h-full gap-2">
                <Loader2 size={20} className="animate-spin text-indigo-400" />
                <p className="text-xs text-slate-400">Searching YouTube...</p>
              </div>
            )}
            {ytResults.length > 0 && (
              <p className="text-[10px] text-slate-600 px-1 pb-1 font-medium">
                Select the correct video — do NOT auto-pick the first result
              </p>
            )}
            {ytResults.map((video) => {
              const isSelected = selectedVideo?.video_id === video.video_id;
              return (
                <div
                  key={video.video_id}
                  onClick={() => handleSelectVideo(video)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background:  isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    border:      `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  {video.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="w-14 h-10 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">{video.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{video.channel_title}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle size={15} className="text-indigo-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected badge — fixed at bottom of left pane */}
          {selectedVideo && (
            <div
              className="shrink-0 px-4 py-2.5 flex items-center gap-2"
              style={{ borderTop: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)' }}
            >
              <Play size={12} className="text-indigo-400 fill-indigo-400 shrink-0" />
              <span className="text-xs text-indigo-300 font-medium truncate flex-1">{selectedVideo.title}</span>
              <span className="text-[10px] text-slate-500 font-mono shrink-0">{selectedVideo.video_id}</span>
            </div>
          )}
        </div>

        {/* ══ RIGHT — Song Details Form ══ */}
        <div className="flex flex-col w-[45%] overflow-y-auto p-5 space-y-4 custom-scrollbar">

          <div>
            <h2
              className="text-sm font-black text-white"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Song Details
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedVideo
                ? '✅ Video linked — fill in the details below.'
                : 'Select a video on the left first.'}
            </p>
          </div>

          {/* Code + Title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Song Code <span className="text-red-400">*</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="5492"
                className="w-full px-3 py-2 rounded-xl text-white text-xs outline-none font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Harana"
                className="w-full px-3 py-2 rounded-xl text-white text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>

          {/* Artist */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Artist <span className="text-red-400">*</span>
            </label>
            <input
              value={form.artist}
              onChange={(e) => setForm((p) => ({ ...p, artist: e.target.value }))}
              placeholder="Parokya ni Edgar"
              className="w-full px-3 py-2 rounded-xl text-white text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Category + Language + Type */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'category', label: 'Category',  options: ['OPM','English','Korean','Japanese','Chinese','Pop','Rock','Classic','Love Songs','Dance','Christmas','Oldies'] },
              { key: 'language', label: 'Language',  options: ['Filipino','English','Korean','Japanese','Chinese','Spanish'] },
              { key: 'song_type',label: 'Type',      options: ['Karaoke','Minus One','Duet','Male Vocal','Female Vocal','Band'] },
            ].map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
                <select
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-xl text-white text-xs outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="">Select...</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Keywords <span className="text-slate-600 normal-case font-normal">(comma-separated)</span>
            </label>
            <input
              value={form.keywords}
              onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
              placeholder="harana, parokya, opm"
              className="w-full px-3 py-2 rounded-xl text-white text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Errors / Success */}
          {saveError && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <span className="text-red-300">{saveError}</span>
            </div>
          )}
          {saveSuccess && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <CheckCircle size={13} className="text-green-400 shrink-0" />
              <span className="text-green-300">Song saved! Redirecting to dashboard...</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={saving || saveSuccess || !selectedVideo}
            className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all mt-auto"
            style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
            title={!selectedVideo ? 'Select a YouTube video first' : ''}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
              : <><Plus size={15} /> Add Song to Catalog</>}
          </button>
        </div>
      </div>
    </div>
  );
}
