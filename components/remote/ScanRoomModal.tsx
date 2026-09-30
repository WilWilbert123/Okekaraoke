'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Camera, X, Wifi, ArrowRight, History } from 'lucide-react';
import { getOrCreateGuestSession, setGuestSessionForInstance } from '@/lib/auth/guestSession';

interface ScanRoomModalProps {
  currentRoomCode?: string;
  isOpen: boolean;
  onClose: () => void;
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('okekaraoke_last_room');
      if (saved && saved !== currentRoomCode) {
        setLastRoom(saved);
      }
    }
  }, [currentRoomCode, isOpen]);

  // Clean up camera stream when modal closes or unmounts
  const stopCamera = () => {
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

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);
    } catch {
      setError('Camera access denied or unavailable. You can enter the room code manually below.');
      setIsScanning(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white">
        
        {/* Close button */}
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-4 right-4 p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-teal-400">
            <QrCode size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              SCAN TV / SWITCH ROOM
            </h3>
            <p className="text-xs text-zinc-400">Connect your phone remote to a TV screen</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Camera QR Scanner Area */}
        <div className="mb-5">
          {isScanning ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-teal-500 bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 border-2 border-dashed border-teal-400/80 m-8 rounded-xl pointer-events-none animate-pulse" />
              <button
                onClick={stopCamera}
                className="absolute bottom-3 px-3 py-1.5 rounded-lg bg-black/80 text-xs font-semibold text-white border border-zinc-700"
              >
                Cancel Scanner
              </button>
            </div>
          ) : (
            <button
              onClick={startCamera}
              className="w-full py-4 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center gap-2 text-sm font-bold text-teal-400 transition-all active:scale-[0.99]"
            >
              <Camera size={18} />
              <span>OPEN CAMERA QR SCANNER</span>
            </button>
          )}
        </div>

        {/* Rejoin Last Room Pill if available */}
        {lastRoom && (
          <div className="mb-4">
            <button
              onClick={() => handleJoinCode(lastRoom)}
              disabled={joining}
              className="w-full p-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 flex items-center justify-between text-xs text-zinc-300 font-medium transition-all"
            >
              <div className="flex items-center gap-2">
                <History size={14} className="text-teal-400" />
                <span>Rejoin Last Room: <strong className="text-white font-bold tracking-wider">{lastRoom}</strong></span>
              </div>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Manual Room Code Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoinCode(newCode);
          }}
          className="space-y-3"
        >
          <div className="relative">
            <Wifi size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="ENTER NEW ROOM CODE"
              maxLength={8}
              className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 font-bold tracking-widest text-center text-sm focus:border-teal-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={joining || newCode.length < 4}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {joining ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>SWITCHING ROOM...</span>
              </>
            ) : (
              <>
                <span>CONNECT TO ROOM</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
