'use client';

// ============================================================
// OKEKARAOKE — Minimal QR Code (Bottom Right Corner)
// White square box with QR code + Room Code display
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
      className="p-1.5 bg-white shadow-2xl flex flex-col items-center justify-center border border-white/20 select-none"
      aria-label={`QR code to join room ${roomCode}`}
    >
      <QRCodeSVG
        value={remoteUrl}
        size={72}
        level="H"
        bgColor="#ffffff"
        fgColor="#000000"
        includeMargin={false}
      />
      <span
        className="text-[11px] font-black text-black uppercase tracking-widest pt-1 pb-0.5 leading-none font-mono"
        style={{ fontFamily: 'Space Grotesk, monospace' }}
      >
        {roomCode.toUpperCase()}
      </span>
    </div>
  );
}
