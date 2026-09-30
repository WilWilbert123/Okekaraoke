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
      className="flex items-center gap-3 p-2.5 rounded-2xl shrink-0 transition-all bg-zinc-950/85 border border-zinc-800 shadow-2xl"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div
        className="shrink-0 p-1.5 rounded-xl bg-white flex items-center justify-center shadow-md"
        aria-label={`QR code to join room ${roomCode}`}
      >
        <QRCodeSVG
          value={remoteUrl}
          size={62}
          level="H"
          bgColor="#ffffff"
          fgColor="#000000"
          includeMargin={false}
        />
      </div>

      <div className="flex flex-col justify-center pr-2">
        <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
          SCAN TO REMOTE
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] font-bold text-zinc-500 font-mono">ROOM</span>
          <span className="text-sm font-black text-teal-400 font-mono tracking-widest" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {roomCode}
          </span>
        </div>
      </div>
    </div>
  );
}
