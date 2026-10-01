'use client';

// ============================================================
// OKEKARAOKE — Remote TV Shoutout Modal
// Sends real-time room shoutouts to TV screen with 50 char limit
// and anti-spam cooldown timer per user.
// ============================================================

import { useState, useEffect } from 'react';
import { Megaphone, X, Send, Clock, CheckCircle } from 'lucide-react';

interface ShoutoutModalProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  guestName: string;
  sessionId: string;
}

const PRESETS = [
  'Shout out sayo naka black!',
  'Happy Birthday pre!',
  'Para sa tropa!',
  'Tagay pa!',
];

export function ShoutoutModal({
  open,
  onClose,
  roomCode,
  guestName,
  sessionId,
}: ShoutoutModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Anti-spam cooldown timer (15s)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!open) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending || cooldown > 0) return;

    setSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/shoutout/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          guest_name: guestName || 'Singer',
          guest_session_id: sessionId,
          message: message.trim().slice(0, 50),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error?.message ?? 'Failed to send shoutout.');
      } else {
        setSentSuccess(true);
        setMessage('');
        setCooldown(15); // Start 15-second anti-spam cooldown
        setTimeout(() => {
          setSentSuccess(false);
          onClose();
        }, 1500);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* 8px Border Radius Monochrome Container */}
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[8px] shadow-2xl flex flex-col overflow-hidden text-zinc-100 font-sans">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] bg-zinc-800 border border-zinc-700 flex items-center justify-center text-teal-400">
              <Megaphone size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Broadcast TV Shoutout
              </h2>
              <p className="text-[10px] text-zinc-400">Float your message on Room {roomCode} TV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[8px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 text-xs">
          {sentSuccess ? (
            <div className="p-4 rounded-[8px] bg-zinc-900 border border-zinc-800 text-teal-300 text-xs font-bold flex flex-col items-center gap-2 text-center">
              <CheckCircle size={28} className="text-teal-400 animate-bounce" />
              <span>Shoutout Broadcasted Live to TV Screen!</span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-3">
              {errorMsg && (
                <div className="p-2.5 rounded-[8px] bg-red-950/80 border border-red-800 text-red-300 text-[11px] font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMessage(preset)}
                      className="px-2 py-1 rounded-[8px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 transition-all active:scale-95 text-left"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Your Shoutout Message
                  </label>
                  <span className={`text-[10px] font-mono font-bold ${isOverLimit ? 'text-red-400' : 'text-zinc-500'}`}>
                    {charCount} / 50 max
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 50))}
                  placeholder="e.g. Shout out kay talong na pogi!"
                  rows={2}
                  maxLength={50}
                  className="w-full p-2.5 rounded-[8px] bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-teal-500 transition-all resize-none"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={sending || !message.trim() || isOverLimit || cooldown > 0}
                className="w-full py-2.5 px-3 rounded-[8px] bg-teal-400 hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : cooldown > 0 ? (
                  <>
                    <Clock size={14} />
                    <span>Please wait {cooldown}s (Cooldown)</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Send Live Shoutout to TV</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
