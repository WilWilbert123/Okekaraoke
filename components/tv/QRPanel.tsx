'use client';

// ============================================================
// OKEKARAOKE — QR Code Panel
// Shows QR code for phone pairing and room info
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
      className="flex items-center justify-end gap-4 px-6 py-3 shrink-0"
      style={{
        background: 'rgba(5, 5, 8, 0.95)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* QR Code + label */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="shrink-0 p-2.5 rounded-xl"
          style={{ background: '#ffffff' }}
          aria-label={`QR code to join room ${roomCode}`}
        >
          <QRCodeSVG
            value={remoteUrl}
            size={90}
            level="H"
            bgColor="#ffffff"
            fgColor="#0a0a12"
            includeMargin={false}
          />
        </div>
        <p
          className="text-xs font-black tracking-widest"
          style={{ color: '#a78bfa', letterSpacing: '0.2em' }}
        >
          SCAN HERE
        </p>
      </div>
    </div>
  );
}

