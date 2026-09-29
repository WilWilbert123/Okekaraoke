'use client';

// ============================================================
// OKEKARAOKE — Floating Compact QR Code Panel
// Transparent glass floating QR card for phone pairing
// ============================================================

import { QRCodeSVG } from 'qrcode.react';

interface QRPanelProps {
  roomCode: string;
  appUrl?: string;
}

export function QRPanel({ roomCode, appUrl }: QRPanelProps) {
  const baseUrl = appUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const remoteUrl = `${baseUrl}/remote/${roomCode}`;

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-2xl shrink-0 transition-all"
      style={{
        background: 'rgba(15, 15, 25, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        className="shrink-0 p-2 rounded-xl"
        style={{ background: '#ffffff' }}
        aria-label={`QR code to join room ${roomCode}`}
      >
        <QRCodeSVG
          value={remoteUrl}
          size={72}
          level="H"
          bgColor="#ffffff"
          fgColor="#0a0a12"
          includeMargin={false}
        />
      </div>

      <div className="hidden sm:flex flex-col justify-center pr-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SCAN TO REMOTE</span>
        <span className="text-xs font-black text-indigo-300 tracking-wider font-mono">ROOM {roomCode}</span>
        <span className="text-[9px] text-slate-400 mt-0.5 max-w-28 truncate">{baseUrl.replace(/^https?:\/\//, '')}</span>
      </div>
    </div>
  );
}
