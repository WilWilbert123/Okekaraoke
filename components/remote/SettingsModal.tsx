'use client';

import { useState } from 'react';
import { Settings, X, Heart, Coffee, MessageSquare, Send, CheckCircle, Smartphone, User, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  guestName: string;
  onUpdateName: (newName: string) => void;
  roomCode: string;
  isInstallable?: boolean;
  onInstallApp?: () => void;
}

export function SettingsModal({
  open,
  onClose,
  guestName,
  onUpdateName,
  roomCode,
  isInstallable,
  onInstallApp,
}: SettingsModalProps) {
  const [feedback, setFeedback] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'feedback' | 'bug' | 'song_request'>('feedback');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingName, setEditingName] = useState(guestName);
  const [nameSaved, setNameSaved] = useState(false);

  if (!open) return null;

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setSending(true);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedback.trim(),
          guest_name: guestName,
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
      {/* Monochrome Sheet Container */}
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100 font-sans">

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-teal-400">
              <Settings size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Remote Settings
              </h2>
              <p className="text-[10px] text-zinc-400">Feedback, Support &amp; Profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close settings"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 text-xs">

          {/* 1. Support Developer Section */}
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-teal-400 shrink-0">
                <Coffee size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Support Developer</h3>
                <p className="text-[10px] text-zinc-400">Support updates &amp; server costs</p>
              </div>
            </div>

            <div>
              <a
                href="https://buymeacoffee.com/wilbert_03"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
              >
                <Coffee size={14} className="fill-black" />
                <span>Buy Me a Coffee</span>
                <ExternalLink size={11} className="opacity-70" />
              </a>
            </div>
          </div>

          {/* 2. Send Feedback / Bug Report / Song Request */}
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare size={14} className="text-teal-400" />
              <h3 className="text-xs font-bold text-white">Send Feedback &amp; Report</h3>
            </div>

            {submitted ? (
              <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-teal-300 text-[11px] flex items-center gap-2 animate-fadeIn">
                <CheckCircle size={15} className="text-teal-400 shrink-0" />
                <span>Submitted to admin! Thank you for your feedback.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-2">
                <div className="flex gap-1">
                  {(['feedback', 'bug', 'song_request'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFeedbackCategory(cat)}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold capitalize transition-all border ${feedbackCategory === cat
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
                  rows={2}
                  className="w-full p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-teal-500 transition-all resize-none"
                />

                <button
                  type="submit"
                  disabled={sending || !feedback.trim()}
                  className="w-full py-2 px-3 rounded-xl bg-teal-400 hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
                >
                  {sending ? (
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Submit {feedbackCategory === 'song_request' ? 'Request' : 'Feedback'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* 3. Display Name & Room Code Profile */}
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-teal-400" />
                <span className="text-xs font-bold text-white">Your Profile</span>
              </div>
              <span className="text-[10px] text-zinc-400">Room: <strong className="text-teal-400 font-mono">{roomCode}</strong></span>
            </div>

            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                maxLength={30}
                placeholder="Your name"
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-teal-500 transition-all"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="px-3 py-1.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-[11px] font-extrabold transition-all active:scale-95"
              >
                {nameSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* 4. App Shortcuts & Footer */}
          {isInstallable && onInstallApp && (
            <button
              onClick={onInstallApp}
              className="w-full py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-[11px] font-bold flex items-center justify-between transition-all active:scale-95"
            >
              <div className="flex items-center gap-1.5">
                <Smartphone size={14} className="text-zinc-300" />
                <span>Install Mobile App</span>
              </div>
              <span className="text-[9px] bg-white text-black px-1.5 py-0.5 rounded-full font-extrabold">PWA</span>
            </button>
          )}

          <div className="text-center text-[10px] text-zinc-500 font-medium pt-0.5">
            Crafted by <span className="text-zinc-400">Wilbert Gamis</span>
          </div>

        </div>
      </div>
    </div>
  );
}
