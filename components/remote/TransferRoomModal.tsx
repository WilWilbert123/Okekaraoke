'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, ArrowRightLeft, Copy, Check, ExternalLink, X, Smartphone, Sparkles, Wifi } from 'lucide-react';

interface TransferRoomModalProps {
  open: boolean;
  onClose: () => void;
  currentRoomCode: string;
  sessionId: string;
  onTransferred?: () => void;
}

export function TransferRoomModal({
  open,
  onClose,
  currentRoomCode,
  sessionId,
  onTransferred,
}: TransferRoomModalProps) {
  const router = useRouter();
  const [targetCode, setTargetCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const tvUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tv/${currentRoomCode.toUpperCase()}`
    : `https://www.okekaraoke.sbs/tv/${currentRoomCode.toUpperCase()}`;

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(tvUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenTvScreen = () => {
    router.push(`/tv/${currentRoomCode.toUpperCase()}`);
    onClose();
  };

  const handleTransferQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    const toCode = targetCode.trim().toUpperCase();

    if (toCode.length < 4) {
      setError('Please enter a valid TV room code.');
      return;
    }

    if (toCode === currentRoomCode.toUpperCase()) {
      setError('Target room code is the same as your current room.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/queue/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_room_code: currentRoomCode,
          to_room_code: toCode,
          guest_session_id: sessionId,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error?.message ?? 'Failed to transfer songs to target TV room.');
        return;
      }

      const count = json.data?.transferred_count ?? 0;
      setSuccessMsg(`Successfully transferred ${count} queued song(s) to room ${toCode}!`);

      // Switch remote to target room after short delay
      setTimeout(() => {
        router.push(`/remote/${toCode}`);
        onClose();
        if (onTransferred) onTransferred();
      }, 1200);
    } catch (err) {
      setError('Network error. Failed to transfer songs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm bg-zinc-950 border border-teal-500/40 rounded-2xl sm:rounded-3xl p-5 shadow-2xl text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95"
          title="Close"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Tv size={20} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-1.5">
              <span>Transfer to TV Screen</span>
              <Sparkles size={14} className="text-amber-400" />
            </h3>
            <p className="text-xs text-zinc-400 font-medium">Move from Solo Phone TV to Big TV Display</p>
          </div>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5">
            <Check size={14} className="text-teal-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Option 1: Open current room TV Display */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 mb-4">
          <p className="text-xs font-extrabold text-teal-400 uppercase tracking-wider mb-1">
            Current Room TV Link: <span className="text-white font-mono">{currentRoomCode}</span>
          </p>
          <p className="text-[11px] text-zinc-400 mb-3">
            Open this URL on any TV, PC, or Tablet to show karaoke lyrics on the big screen!
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              {copied ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied Link!' : 'Copy TV Link'}</span>
            </button>

            <button
              onClick={handleOpenTvScreen}
              className="py-2 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-black text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
            >
              <span>Launch TV</span>
              <ExternalLink size={14} />
            </button>
          </div>
        </div>

        {/* Option 2: Transfer Queued Songs to another TV Room */}
        <form onSubmit={handleTransferQueue} className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800">
          <p className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <ArrowRightLeft size={13} />
            <span>Transfer Queue to Another TV Room</span>
          </p>
          <p className="text-[11px] text-zinc-400 mb-3">
            At a friend&apos;s house or venue with a TV? Enter their TV room code to move your song queue over!
          </p>

          <div className="relative mb-2.5">
            <Wifi size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={targetCode}
              onChange={(e) => setTargetCode(e.target.value.toUpperCase())}
              placeholder="ENTER TV ROOM CODE (e.g. JU7U)"
              maxLength={8}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 text-xs font-mono font-bold tracking-wider outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading || targetCode.trim().length < 4}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>TRANSFERRING SONGS...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={14} />
                <span>TRANSFER MY QUEUE TO TV</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
