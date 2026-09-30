'use client';

// ============================================================
// OKEKARAOKE — Name Modal
// Shows on first remote open so every user has a display name
// before chatting. Suggests a random fun guest name.
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Mic2, Shuffle } from 'lucide-react';

// ── Random name pool ─────────────────────────────────────────
const ADJECTIVES = [
  'Funky', 'Silly', 'Golden', 'Smooth', 'Cosmic', 'Blazing', 'Neon',
  'Radical', 'Chill', 'Epic', 'Groovy', 'Electric', 'Wild', 'Lucky',
  'Shiny', 'Jazzy', 'Loud', 'Sassy', 'Mellow', 'Stellar',
];

const NOUNS = [
  'Singer', 'Star', 'Mic', 'Note', 'Diva', 'Rockstar', 'Bard', 'Legend',
  'Voice', 'Maestro', 'Vocalist', 'Crooner', 'Belter', 'Showman', 'Vibe',
  'Fanatic', 'Superstar', 'Idol', 'Performer', 'Anthem',
];

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

interface NameModalProps {
  open: boolean;
  onConfirm: (name: string) => void;
}

export function NameModal({ open, onConfirm }: NameModalProps) {
  const [value, setValue] = useState('');
  const [suggested, setSuggested] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const name = randomName();
      setSuggested(name);
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleConfirm = () => {
    const name = value.trim() || suggested;
    onConfirm(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-3xl p-6 flex flex-col gap-5"
        style={{
          background: 'linear-gradient(160deg, #0f0f1a 0%, #12111f 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 -4px 60px rgba(99,102,241,0.2)',
        }}
      >
        {/* Logo + greeting */}
        <div className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/okekaraokelogo.png" alt="OKEKARAOKE" className="w-24 h-24 object-contain drop-shadow-md" />
          <h2
            className="text-xl font-black text-white"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Welcome to the Room!
          </h2>
          <p className="text-sm text-slate-400">
            Pick a name so others know who&apos;s singing 🎤
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Your Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={suggested}
            maxLength={30}
            className="w-full px-4 py-3 rounded-2xl text-white text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.35)',
              caretColor: '#a78bfa',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.7)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.35)'; }}
          />

          {/* Suggested name chip */}
          <button
            onClick={() => setValue(suggested)}
            className="self-start flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#a78bfa',
            }}
          >
            <Shuffle size={11} />
            Use &quot;{suggested}&quot;
          </button>
        </div>

        {/* CTA */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          }}
        >
          {value.trim() ? `Join as "${value.trim()}"` : `Join as "${suggested}"`}
        </button>

        <p className="text-[11px] text-slate-600 text-center -mt-1">
          You can change your name anytime from the header
        </p>
      </div>
    </div>
  );
}
