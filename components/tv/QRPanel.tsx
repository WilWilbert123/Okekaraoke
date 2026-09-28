'use client';

// ============================================================
// OKEKARAOKE — QR Code Panel
// Shows QR code for phone pairing and room info
// ============================================================

import { QRCodeSVG } from 'qrcode.react';
import { Smartphone } from 'lucide-react';

interface QRPanelProps {
  roomCode: string;
  appUrl?: string;
}

export function QRPanel({ roomCode, appUrl }: QRPanelProps) {
  const baseUrl = appUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const remoteUrl = `${baseUrl}/remote/${roomCode}`;

  return (
    <div
      className="flex items-center justify-between gap-6 px-6 py-4 shrink-0"
      style={{
        background: 'rgba(5, 5, 8, 0.95)',
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* Instructions */}
      <div className="flex items-center gap-3">
        <Smartphone size={24} className="text-indigo-400 shrink-0" />
        <div>
          <p className="font-bold text-white">SCAN TO RESERVE SONGS</p>
          <p className="text-sm text-slate-400">Point your phone camera at the QR code</p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">{remoteUrl}</p>
        </div>
      </div>

      {/* QR Code */}
      <div
        className="shrink-0 p-3 rounded-xl"
        style={{ background: '#ffffff' }}
        aria-label={`QR code to join room ${roomCode}`}
      >
        <QRCodeSVG
          value={remoteUrl}
          size={100}
          level="H"
          bgColor="#ffffff"
          fgColor="#0a0a12"
          includeMargin={false}
        />
      </div>
    </div>
  );
}
