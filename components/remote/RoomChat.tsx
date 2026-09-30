'use client';

// ============================================================
// OKEKARAOKE — Room Chat Component
// Real-time in-room group chat with persistent database storage
// & local storage fallback so messages stay across page refreshes.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, Users } from 'lucide-react';
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
  const [onlineUsers, setOnlineUsers] = useState<Array<{ name?: string; session_id?: string; device_type?: string }>>([]);
  const [showUserModal, setShowUserModal] = useState(false);

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

  // ── 2. Subscribe to room broadcast & presence channel ──────────────
  useEffect(() => {
    const channelName = `okekaraoke:chat:${roomCode}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true }, presence: { key: sessionId } },
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
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeList: Array<{ name?: string; session_id?: string; device_type?: string }> = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.name || p.session_id) activeList.push(p);
          });
        });
        setOnlineUsers(activeList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setJoined(true);
          await channel.track({
            session_id: sessionId,
            name: guestName || 'Guest Remote',
            device_type: 'remote',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setJoined(false);
    };
  }, [roomCode, supabase, sessionId, guestName, saveToLocalStorage]);

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

  const userCount = Math.max(1, onlineUsers.length);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Room Chat Header Bar */}
      <div
        className="px-4 py-2.5 shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <MessageCircle size={14} className="text-indigo-400" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Room Chat
        </span>

        {/* User Count Pill -> Tapping opens Online Members Modal */}
        <button
          onClick={() => setShowUserModal(true)}
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#4ade80',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
          title="Click to view online room members"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          <Users size={12} className="text-green-400" />
          <span>{userCount} {userCount === 1 ? 'User' : 'Users'}</span>
        </button>
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

      {/* Online Users Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div
            className="relative w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-green-400" />
                <span className="text-sm font-black text-white font-mono tracking-wider">
                  ROOM MEMBERS ({userCount})
                </span>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Active users connected to Room <span className="text-indigo-400 font-bold">{roomCode}</span>:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {(onlineUsers.length > 0 ? onlineUsers : [{ name: guestName || 'You (Guest)', session_id: sessionId }]).map((user, idx) => {
                const isCurrent = user.session_id === sessionId;
                return (
                  <div
                    key={user.session_id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                      <span className="font-bold text-slate-200 truncate">
                        {user.name || 'Guest Remote'}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-green-400 shrink-0">
                      ONLINE
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowUserModal(false)}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-center mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
