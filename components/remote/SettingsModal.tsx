'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Coffee,
  MessageSquare,
  Send,
  CheckCircle,
  ExternalLink,
  User,
  Share2,
  Copy,
  Check,
  QrCode,
  Link as LinkIcon,
  Download,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  guestName: string;
  onUpdateName: (newName: string) => void;
  roomCode: string;
}

export function SettingsModal({
  open,
  onClose,
  guestName,
  onUpdateName,
  roomCode,
}: SettingsModalProps) {
  const [feedback, setFeedback] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'feedback' | 'bug' | 'song_request'>('feedback');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingName, setEditingName] = useState(guestName);
  const [nameSaved, setNameSaved] = useState(false);

  const [shareMode, setShareMode] = useState<'link' | 'qr'>('link');
  const [shareTarget, setShareTarget] = useState<'app' | 'room'>(roomCode ? 'room' : 'app');
  const [copied, setCopied] = useState(false);
  const [instagramNotice, setInstagramNotice] = useState(false);

  // Sync editingName when guestName prop changes or modal opens
  useEffect(() => {
    setEditingName(guestName);
    if (roomCode) {
      setShareTarget('room');
    }
  }, [guestName, open, roomCode]);

  if (!open) return null;

  const currentUrl =
    shareTarget === 'room' && roomCode
      ? `https://okekaraoke.sbs/remote/${roomCode}`
      : 'https://okekaraoke.sbs';

  const shareTitle =
    shareTarget === 'room' && roomCode
      ? `Join my OkeKaraoke room (${roomCode})`
      : 'OkeKaraoke - Free Online Karaoke';

  const shareMessage =
    shareTarget === 'room' && roomCode
      ? `Join my OkeKaraoke room (${roomCode}) and let's sing karaoke together! 🎤✨`
      : `Sing karaoke together on OkeKaraoke! Free online karaoke for everyone 🎤✨`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareMessage} ${currentUrl}`)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(currentUrl)}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = currentUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silently
    }
  };

  const handleDownloadQr = () => {
    const svgEl = document.getElementById('share-qr-code-svg');
    if (!svgEl) return;
    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width + 40;
        canvas.height = img.height + 40;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 20, 20);
          const pngFile = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = `okekaraoke-qr-${shareTarget === 'room' ? roomCode : 'app'}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch {
      // Fallback silently
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareMessage,
          url: currentUrl,
        });
      } catch {
        // User closed share sheet
      }
    } else {
      handleCopyLink();
    }
  };

  const handleInstagramShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareMessage} ${currentUrl}`,
          url: currentUrl,
        });
      } catch {
        // User closed share sheet
      }
    } else {
      await handleCopyLink();
      setInstagramNotice(true);
      setTimeout(() => setInstagramNotice(false), 3500);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSending(true);

    const displayName = guestName?.trim() || editingName?.trim() || 'Anonymous';

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedback.trim(),
          guest_name: displayName,
          room_code: roomCode,
        }),
      });
    } catch {
      // Fallback
    } finally {
      setSending(false);
      setSubmitted(true);
      setFeedback('');
    }
  };

  const handleSaveName = () => {
    if (editingName.trim()) {
      onUpdateName(editingName.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Container Sheet */}
      <div className="w-full max-w-[420px] bg-zinc-950 border border-zinc-800 rounded-[12px] shadow-2xl flex flex-col overflow-hidden text-zinc-100 font-sans max-h-[88vh]">

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-zinc-800 border border-zinc-700 flex items-center justify-center text-teal-400">
              <Settings size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Remote Settings
              </h2>
              <p className="text-[10px] text-zinc-400">Share, Feedback, Support &amp; Profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[8px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close settings"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 text-xs overflow-y-auto max-h-[calc(88vh-55px)]">

          {/* 1. Share App & Room Section */}
          <div className="p-3 rounded-[10px] bg-zinc-900 border border-zinc-800 space-y-2.5">
            {/* Header + Sub-tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/okekaraokelogo.png" alt="OkeKaraoke" className="w-5 h-5 object-contain" />
                <h3 className="text-xs font-bold text-white">Share</h3>
              </div>

              {/* Share Mode Sub-tabs */}
              <div className="flex p-0.5 rounded-[6px] bg-zinc-950 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShareMode('link')}
                  className={`px-2.5 py-1 rounded-[4px] text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                    shareMode === 'link'
                      ? 'bg-teal-400 text-black font-extrabold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <LinkIcon size={11} />
                  <span>Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode('qr')}
                  className={`px-2.5 py-1 rounded-[4px] text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                    shareMode === 'qr'
                      ? 'bg-teal-400 text-black font-extrabold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <QrCode size={11} />
                  <span>QR Code</span>
                </button>
              </div>
            </div>

            {/* Target Selector (App vs Room) */}
            <div className="flex items-center justify-between text-[10px] pt-0.5">
              <span className="text-zinc-400 font-medium">
                Sharing: <span className="text-teal-300 font-bold">{shareTarget === 'room' && roomCode ? `Room ${roomCode}` : 'App Link'}</span>
              </span>

              {roomCode && (
                <div className="flex p-0.5 rounded-[6px] bg-zinc-950 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShareTarget('app')}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition-all ${
                      shareTarget === 'app'
                        ? 'bg-zinc-800 text-teal-400 font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    App
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareTarget('room')}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold transition-all ${
                      shareTarget === 'room'
                        ? 'bg-zinc-800 text-teal-400 font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Room
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT: LINK MODE */}
            {shareMode === 'link' ? (
              <>
                {/* Display URL Box & Copy */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-[8px] bg-zinc-950 border border-zinc-800">
                  <input
                    type="text"
                    readOnly
                    value={currentUrl}
                    className="flex-1 bg-transparent px-1.5 text-[11px] font-mono text-zinc-300 outline-none select-all overflow-hidden text-ellipsis whitespace-nowrap"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-2.5 py-1.5 rounded-[6px] text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95 shrink-0 ${
                      copied
                        ? 'bg-emerald-500 text-black'
                        : 'bg-teal-400 hover:bg-teal-300 text-black'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                {/* Social Share Grid - Clean Logo Only */}
                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  {/* WhatsApp */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-[8px] bg-zinc-950 hover:bg-emerald-500/20 border border-zinc-800 hover:border-emerald-500/50 text-emerald-400 flex items-center justify-center transition-all group active:scale-95 shadow-sm"
                    title="Share on WhatsApp"
                    aria-label="Share on WhatsApp"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </a>

                  {/* Facebook */}
                  <a
                    href={fbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-[8px] bg-zinc-950 hover:bg-blue-500/20 border border-zinc-800 hover:border-blue-500/50 text-blue-400 flex items-center justify-center transition-all group active:scale-95 shadow-sm"
                    title="Share on Facebook"
                    aria-label="Share on Facebook"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>

                  {/* Instagram */}
                  <button
                    type="button"
                    onClick={handleInstagramShare}
                    className="flex-1 py-2.5 rounded-[8px] bg-zinc-950 hover:bg-pink-500/20 border border-zinc-800 hover:border-pink-500/50 text-pink-400 flex items-center justify-center transition-all group active:scale-95 shadow-sm"
                    title="Share on Instagram"
                    aria-label="Share on Instagram"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </button>

                  {/* X (Twitter) */}
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-[8px] bg-zinc-950 hover:bg-sky-500/20 border border-zinc-800 hover:border-sky-500/50 text-sky-400 flex items-center justify-center transition-all group active:scale-95 shadow-sm"
                    title="Share on X (Twitter)"
                    aria-label="Share on X"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>

                  {/* More Native Share */}
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex-1 py-2.5 rounded-[8px] bg-zinc-950 hover:bg-teal-400/20 border border-zinc-800 hover:border-teal-400/50 text-teal-400 flex items-center justify-center transition-all group active:scale-95 shadow-sm"
                    title="Open device share menu"
                    aria-label="More share options"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {instagramNotice && (
                  <div className="p-2 rounded-[6px] bg-purple-950/80 border border-purple-800 text-purple-200 text-[10px] text-center font-medium animate-fadeIn">
                    Link copied! Paste in Instagram Stories/DM 📸
                  </div>
                )}
              </>
            ) : (
              /* TAB CONTENT: QR CODE MODE */
              <div className="flex flex-col items-center justify-center py-2 space-y-3 animate-fadeIn">
                {/* QR Display Frame */}
                <div className="p-3 bg-white rounded-[14px] shadow-xl border border-zinc-200 flex flex-col items-center">
                  <QRCodeSVG
                    id="share-qr-code-svg"
                    value={currentUrl}
                    size={140}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    includeMargin={false}
                  />

                  {/* Room Code Badge at Bottom of QR Code */}
                  {shareTarget === 'room' && roomCode ? (
                    <div className="mt-2 px-3 py-1 bg-zinc-950 border border-teal-500/40 rounded-full flex items-center gap-1.5 shadow-inner">
                      <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">ROOM:</span>
                      <span
                        className="text-xs font-black text-teal-400 tracking-widest font-mono"
                        style={{ fontFamily: 'Space Grotesk, monospace' }}
                      >
                        {roomCode.toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider">OKEKARAOKE APP</span>
                    </div>
                  )}
                </div>

                <p className="text-[10.5px] text-zinc-400 text-center max-w-[260px]">
                  Scan with camera to {shareTarget === 'room' && roomCode ? `join Room ${roomCode}` : 'open OkeKaraoke'}
                </p>

                {/* Quick Action Buttons for QR */}
                <div className="flex items-center gap-2 w-full pt-1">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex-1 py-1.5 px-2.5 rounded-[6px] text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                      copied
                        ? 'bg-emerald-500 text-black'
                        : 'bg-zinc-950 border border-zinc-800 hover:border-teal-400/50 text-teal-300'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    className="flex-1 py-1.5 px-2.5 rounded-[6px] bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                  >
                    <Download size={12} />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Support Developer Button */}
          <a
            href="https://buymeacoffee.com/wilbert_03"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3.5 rounded-[10px] bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 shadow"
          >
            <Coffee size={15} className="fill-black" />
            <span>Buy Me a Coffee</span>
            <ExternalLink size={12} className="opacity-75" />
          </a>

          {/* 3. Send Feedback & Report Section */}
          <div className="p-3 rounded-[10px] bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={14} className="text-teal-400" />
                <h3 className="text-xs font-bold text-white">Send Feedback &amp; Report</h3>
              </div>
            </div>

            {submitted ? (
              <div className="p-2.5 rounded-[8px] bg-zinc-800 border border-zinc-700 text-teal-300 text-[11px] flex items-center gap-2 animate-fadeIn">
                <CheckCircle size={14} className="text-teal-400 shrink-0" />
                <span>Feedback submitted! Thank you.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-2">
                <div className="flex gap-1.5">
                  {(['feedback', 'bug', 'song_request'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFeedbackCategory(cat)}
                      className={`flex-1 py-1 px-1.5 rounded-[6px] text-[10px] font-bold capitalize transition-all border ${
                        feedbackCategory === cat
                          ? 'bg-teal-400 border-teal-400 text-black font-extrabold shadow'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat === 'song_request' ? 'Song Request' : cat}
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    feedbackCategory === 'bug'
                      ? 'Describe issue...'
                      : feedbackCategory === 'song_request'
                        ? 'Song title or artist name...'
                        : 'Your feedback or thoughts...'
                  }
                  maxLength={200}
                  rows={2}
                  className="w-full p-2 rounded-[8px] bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-teal-500 transition-all resize-none h-14"
                />

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">
                    As: <strong className="text-teal-400">{guestName || editingName || 'Anon'}</strong>
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-zinc-500 font-mono text-[9.5px]">{feedback.length}/200</span>
                    <button
                      type="submit"
                      disabled={sending || !feedback.trim()}
                      className="py-1.5 px-3.5 rounded-[6px] bg-teal-400 hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-[11px] font-extrabold flex items-center gap-1.5 transition-all active:scale-95 shadow"
                    >
                      {sending ? (
                        <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={12} />
                          <span>Submit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* 4. Display Name & Room Code Profile */}
          <div className="p-3 rounded-[10px] bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-teal-400" />
                <span className="text-xs font-bold text-white">Your Profile</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-zinc-500 font-mono text-[9.5px]">{editingName.length}/20</span>
                <span className="text-zinc-400">Room: <strong className="text-teal-400 font-mono font-extrabold">{roomCode}</strong></span>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                maxLength={20}
                placeholder="Your name (max 20 chars)"
                className="flex-1 px-2.5 py-1.5 rounded-[6px] bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-teal-500 transition-all"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="px-3.5 py-1.5 rounded-[6px] bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-extrabold transition-all active:scale-95"
              >
                {nameSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          <div className="text-center text-[10px] text-zinc-500 font-medium pt-0.5">
            Crafted by <span className="text-zinc-400">Wilbert Gamis</span>
          </div>

        </div>
      </div>
    </div>
  );
}



