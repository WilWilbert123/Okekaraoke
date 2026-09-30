'use client';

// ============================================================
// OKEKARAOKE — Room Chat Component
// Real-time in-room group chat with persistent database storage
// & local storage fallback so messages stay across page refreshes.
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

  const storageKey = `okekaraoke_chat_${roomCode.toUpperCase()}`;

  // Helper to save messages to local storage
  const saveToLocalStorage = useCallback((msgs: ChatMessage[]) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-150)));
      }
    } catch (e) {
      console.warn('Failed to save chat to localStorage:', e);
    }
  }, [storageKey]);

  // ── 1. Load initial chat (localStorage + DB API) ────────
  useEffect(() => {
    let isMounted = true;

    // First load from localStorage immediately
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read chat from localStorage:', e);
    }

    // Then fetch persisted chat from server API
    async function fetchServerChat() {
      try {
        const res = await fetch(`/api/instances/${roomCode}/chat`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.messages) && isMounted) {
          setMessages((prev) => {
            const map = new Map<string, ChatMessage>();
            // Add previous local messages
            prev.forEach((m) => map.set(m.id, m));
            // Add server messages (takes precedence if available)
            json.messages.forEach((m: ChatMessage) => map.set(m.id, m));
            const merged = Array.from(map.values()).sort((a, b) => a.sent_at - b.sent_at);
            saveToLocalStorage(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Error fetching server chat:', err);
      }
    }

    fetchServerChat();

    return () => {
      isMounted = false;
    };
  }, [roomCode, storageKey, saveToLocalStorage]);

  // ── 2. Subscribe to room broadcast channel ──────────────
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
          if (prev.some((m) => m.id === msg.id)) return prev;
          const updated = [...prev, msg].sort((a, b) => a.sent_at - b.sent_at);
          saveToLocalStorage(updated);
          return updated;
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
  }, [roomCode, supabase, saveToLocalStorage]);

  // ── Auto-scroll to bottom when new messages arrive ───────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 3. Send a message ─────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const displayName = guestName?.trim() || 'Guest';
    const tempId = `${sessionId}-${Date.now()}`;

    const newMsg: ChatMessage = {
      id: tempId,
      sender_name: displayName,
      sender_session_id: sessionId,
      text,
      sent_at: Date.now(),
    };

    setSending(true);
    setInput('');

    // Optimistically update local state & localStorage
    setMessages((prev) => {
      const updated = [...prev, newMsg].sort((a, b) => a.sent_at - b.sent_at);
      saveToLocalStorage(updated);
      return updated;
    });

    try {
      // Broadcast to other live users in room via Realtime
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: newMsg,
        });
      }

      // Persist message to database via API
      await fetch(`/api/instances/${roomCode}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: displayName,
          sender_session_id: sessionId,
          text,
        }),
      });
    } catch (err) {
      console.warn('Failed to send/save chat message:', err);
    } finally {
      setSending(false);
    }
  }, [input, sessionId, guestName, roomCode, sending, saveToLocalStorage]);

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
                      background: `hsl(${Math.abs((msg.sender_name || 'G').charCodeAt(0) * 47) % 360}, 60%, 20%)`,
                      border: `1px solid hsl(${Math.abs((msg.sender_name || 'G').charCodeAt(0) * 47) % 360}, 60%, 35%)`,
                      color: `hsl(${Math.abs((msg.sender_name || 'G').charCodeAt(0) * 47) % 360}, 80%, 70%)`,
                    }}
                  >
                    {(msg.sender_name || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] text-slate-600 font-medium">
                  {isMe ? 'You' : msg.sender_name}
                </span>
                <span className="text-[10px] text-slate-700">{formatTime(msg.sent_at)}</span>
              </div>

              {/* Bubble */}
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug break-words"
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
            placeholder={`Message room ${roomCode}...`}
            maxLength={200}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none transition-all placeholder-slate-600"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(99,102,241,0.5)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
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
