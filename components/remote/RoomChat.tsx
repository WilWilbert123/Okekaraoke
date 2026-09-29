'use client';

// ============================================================
// OKEKARAOKE — Room Chat Component
// Real-time in-room group chat using Supabase broadcast
// Only users in the same room can see & send messages
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatMessage {
  id: string;
  sender_name: string;
  sender_session_id: string;
  text: string;
  sent_at: number; // unix ms
}

interface RoomChatProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomChat({ roomCode, sessionId, guestName }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabase = createClient();

  // ── Subscribe to room broadcast channel ──────────────────
  useEffect(() => {
    const channelName = `okekaraoke:chat:${roomCode}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => {
          // Deduplicate by id
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => a.sent_at - b.sent_at);
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setJoined(true);
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setJoined(false);
    };
  }, [roomCode, supabase]);

  // ── Auto-scroll to bottom when new messages arrive ───────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send a message via broadcast ─────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !channelRef.current || sending) return;

    const displayName = guestName?.trim() || 'Guest';
    const msg: ChatMessage = {
      id: `${sessionId}-${Date.now()}`,
      sender_name: displayName,
      sender_session_id: sessionId,
      text,
      sent_at: Date.now(),
    };

    setSending(true);
    setInput('');

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg,
      });
    } finally {
      setSending(false);
    }
  }, [input, sessionId, guestName, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>

      {/* Room badge */}
      <div
        className="px-4 py-2.5 shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <MessageCircle size={14} className="text-indigo-400" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Room Chat
        </span>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: joined ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
            color: joined ? '#4ade80' : '#818cf8',
            border: `1px solid ${joined ? 'rgba(34,197,94,0.25)' : 'rgba(99,102,241,0.25)'}`,
          }}
        >
          {joined ? '● LIVE' : 'Connecting...'}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <MessageCircle size={28} className="text-indigo-500" />
            </div>
            <p className="text-sm font-bold text-slate-400">No messages yet</p>
            <p className="text-xs text-slate-600 max-w-[200px]">
              Say hello to everyone in Room {roomCode}! Only people in this room can see your messages.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_session_id === sessionId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}
            >
              {/* Sender name + time */}
              <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                    style={{
                      background: `hsl(${Math.abs(msg.sender_name.charCodeAt(0) * 47) % 360}, 60%, 20%)`,
                      border: `1px solid hsl(${Math.abs(msg.sender_name.charCodeAt(0) * 47) % 360}, 60%, 35%)`,
                      color: `hsl(${Math.abs(msg.sender_name.charCodeAt(0) * 47) % 360}, 80%, 70%)`,
                    }}
                  >
                    {msg.sender_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] text-slate-600 font-medium">
                  {isMe ? 'You' : msg.sender_name}
                </span>
                <span className="text-[10px] text-slate-700">{formatTime(msg.sent_at)}</span>
              </div>

              {/* Bubble */}
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug"
                style={
                  isMe
                    ? {
                        background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                        color: '#ffffff',
                        borderBottomRightRadius: '6px',
                      }
                    : {
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e2e8f0',
                        borderBottomLeftRadius: '6px',
                      }
                }
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="px-4 py-3 shrink-0"
        style={{
          background: 'rgba(5, 5, 8, 0.95)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={joined ? `Message room ${roomCode}...` : 'Connecting...'}
            maxLength={200}
            disabled={!joined}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none transition-all placeholder-slate-600 disabled:opacity-40"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !joined || sending}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
            aria-label="Send message"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-1.5 text-center">
          Only users in this room can see messages
        </p>
      </div>
    </div>
  );
}
