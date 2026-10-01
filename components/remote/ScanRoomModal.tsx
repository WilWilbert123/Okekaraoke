'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Camera, X, Wifi, ArrowRight, History, Loader2 } from 'lucide-react';
import { getOrCreateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';

interface ScanRoomModalProps {
  currentRoomCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Extract room code from scanned QR string or URL
function extractRoomCode(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Match URL format e.g. https://domain.com/remote/FT5N
  const urlMatch = trimmed.match(/\/(?:remote|tv)\/([A-Za-z0-9]{4,8})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toUpperCase();
  }
  // Match direct code e.g. FT5N
  if (/^[A-Za-z0-9]{4,8}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

export function ScanRoomModal({ currentRoomCode, isOpen, onClose }: ScanRoomModalProps) {
  const router = useRouter();
  const [newCode, setNewCode] = useState('');
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('okekaraoke_last_room');
      if (saved && saved !== currentRoomCode) {
        setLastRoom(saved);
      }
    }
  }, [currentRoomCode, isOpen]);

  // Stop camera and cancel QR scanning loop
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Join target room code
  const handleJoinCode = async (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setError('Please enter a valid room code.');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const session = getOrCreateGuestSession();
      const res = await fetch('/api/instances/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: cleanCode,
          guest_session_id: session.session_id,
          device_type: 'remote',
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Room not found. Please check the TV screen code.');
        setJoining(false);
        return;
      }

      setGuestSessionForInstance(json.data.instance.id, cleanCode, 'remote');
      localStorage.setItem('okekaraoke_last_room', cleanCode);
      stopCamera();
      onClose();
      router.push(`/remote/${cleanCode}`);
    } catch {
      setError('Network error. Please try again.');
      setJoining(false);
    }
  };

  // Continuous frame QR Code Reader loop (Android + iOS BarcodeDetector)
  const scanLoop = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;

    if (video.readyState >= 2) {
      try {
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              const codeFound = extractRoomCode(rawValue);
              if (codeFound) {
                stopCamera();
                handleJoinCode(codeFound);
                return;
              }
            }
          }
        }
      } catch {
        // Frame processing error ignored
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanLoop);
  };

  // Start back camera with video stream + QR scan loop
  const startCamera = async () => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsScanning(true);
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    } catch {
      setError('Camera permission denied or unavailable. Please enter room code below.');
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* 8px Border Radius Monochrome Sheet Container */}
      <div className="w-full max-w-xs sm:max-w-sm bg-zinc-950 border border-zinc-800 rounded-[8px] shadow-2xl p-4 text-white flex flex-col font-sans">

        {/* Header with Title and Close Button cleanly aligned */}
        <div className="flex items-start justify-between pb-2.5 mb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-[8px] bg-zinc-900 border border-zinc-800 flex items-center justify-center text-teal-400 shrink-0">
              <QrCode size={15} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-white tracking-tight truncate" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                SCAN TV / SWITCH ROOM
              </h3>
              <p className="text-[10px] text-zinc-400 truncate">Connect remote to a TV screen</p>
            </div>
          </div>

          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-7 h-7 rounded-[8px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-3 p-2.5 rounded-[8px] bg-red-950/80 border border-red-800 text-[11px] text-red-300">
            {error}
          </div>
        )}

        {/* Camera QR Scanner Area */}
        <div className="mb-3">
          {isScanning ? (
            <div className="relative rounded-[8px] overflow-hidden border border-teal-500/80 bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 border border-dashed border-teal-400/80 m-4 rounded-[8px] pointer-events-none animate-pulse" />
              <button
                type="button"
                onClick={stopCamera}
                className="absolute bottom-2 px-2.5 py-1 rounded-[8px] bg-black/80 text-[10px] font-bold text-white border border-zinc-700"
              >
                Cancel Scanner
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="w-full py-2.5 px-3 rounded-[8px] bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 flex items-center justify-center gap-2 text-xs font-bold text-teal-400 transition-all active:scale-95 shadow-sm"
            >
              <Camera size={15} />
              <span>OPEN CAMERA</span>
            </button>
          )}
        </div>

        {/* Rejoin Last Room Pill if available */}
        {lastRoom && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => handleJoinCode(lastRoom)}
              disabled={joining}
              className="w-full p-2.5 rounded-[8px] bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300 font-medium transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <History size={13} className="text-teal-400 shrink-0" />
                <span className="text-[11px] truncate">Rejoin: <strong className="text-white font-mono font-bold tracking-wider">{lastRoom}</strong></span>
              </div>
              <ArrowRight size={13} className="shrink-0" />
            </button>
          </div>
        )}

        {/* Manual Room Code Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoinCode(newCode);
          }}
          className="space-y-2.5"
        >
          <div className="relative">
            <Wifi size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE (E.G. FT5N)"
              maxLength={8}
              className="w-full pl-8 pr-3 py-2 rounded-[8px] bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 font-mono font-bold tracking-widest text-center text-xs focus:border-teal-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={joining || newCode.length < 4}
            className="w-full py-2.5 px-3 rounded-[8px] bg-white hover:bg-zinc-200 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 shadow"
          >
            {joining ? (
              <>
                <Loader2 size={13} className="animate-spin text-black" />
                <span>CONNECTING...</span>
              </>
            ) : (
              <>
                <span>CONNECT TO ROOM</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
