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

export interface OnlineUser {
  session_id: string;
  name: string;
  device_type?: string;
  online_at?: string;
}

interface RoomChatProps {
  roomCode: string;
  sessionId: string;
  guestName: string;
  onlineUsers?: OnlineUser[];
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomChat({ roomCode, sessionId, guestName, onlineUsers: parentOnlineUsers }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
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

  const [localOnlineUsers, setLocalOnlineUsers] = useState<OnlineUser[]>([]);

  // ── 2. Subscribe to room broadcast chat channel ──────────────
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
        const activeList: OnlineUser[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.name || p.session_id) {
              activeList.push({
                session_id: p.session_id || p.name,
                name: p.name || 'Guest Remote',
                device_type: p.device_type || 'remote',
              });
            }
          });
        });
        setLocalOnlineUsers(activeList);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
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

  const activeOnlineUsers = (parentOnlineUsers && parentOnlineUsers.length > 0)
    ? parentOnlineUsers
    : (localOnlineUsers && localOnlineUsers.length > 0)
      ? localOnlineUsers
      : [{ session_id: sessionId, name: guestName || 'You (Guest)', device_type: 'remote' }];

  const userCount = Math.max(1, activeOnlineUsers.length);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)' }}>
      {/* Room Chat Header Bar */}
      <div
        className="px-4 py-2.5 shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <MessageCircle size={14} className="text-teal-400" />
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Room Chat
        </span>

        {/* User Count Pill -> Tapping opens Online Members Modal */}
        <button
          onClick={() => setShowUserModal(true)}
          className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(45, 212, 191, 0.12)',
            color: '#2dd4bf',
            border: '1px solid rgba(45, 212, 191, 0.3)',
          }}
          title="Click to view online room members"
        >
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse inline-block" />
          <Users size={12} className="text-teal-400" />
          <span>{userCount} {userCount === 1 ? 'User' : 'Users'}</span>
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-zinc-900 border border-zinc-800"
            >
              <MessageCircle size={28} className="text-teal-400" />
            </div>
            <p className="text-sm font-bold text-zinc-300">No messages yet</p>
            <p className="text-xs text-zinc-500 max-w-[200px]">
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
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 bg-zinc-800 border border-zinc-700 text-zinc-300"
                  >
                    {(msg.sender_name || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] text-zinc-400 font-medium">
                  {isMe ? 'You' : msg.sender_name}
                </span>
                <span className="text-[10px] text-zinc-600">{formatTime(msg.sent_at)}</span>
              </div>

              {/* Bubble */}
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug break-words"
                style={
                  isMe
                    ? {
                        background: '#ffffff',
                        color: '#000000',
                        fontWeight: 600,
                        borderBottomRightRadius: '6px',
                      }
                    : {
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#f4f4f5',
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
        className="px-4 py-3 shrink-0 bg-zinc-950 border-t border-zinc-800"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message room ${roomCode}...`}
            maxLength={200}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white outline-none transition-all placeholder-zinc-500 bg-zinc-900 border border-zinc-800"
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(45, 212, 191, 0.6)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#27272a';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-teal-400 hover:bg-teal-300 text-black font-bold transition-all active:scale-95 disabled:opacity-30"
            aria-label="Send message"
          >
            <Send size={15} className="text-black" />
          </button>
        </div>
      </div>

      {/* Online Users Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="relative w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-teal-400" />
                <span className="text-sm font-black text-white font-mono tracking-wider">
                  ROOM MEMBERS ({userCount})
                </span>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Active users connected to Room <span className="text-teal-400 font-bold">{roomCode}</span>:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {activeOnlineUsers.map((user, idx) => {
                const isCurrent = user.session_id === sessionId;
                return (
                  <div
                    key={user.session_id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl text-xs bg-zinc-900 border border-zinc-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                      <span className="font-bold text-zinc-200 truncate">
                        {user.name || 'Guest Remote'}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-teal-400 shrink-0">
                      ONLINE
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowUserModal(false)}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-white text-black hover:bg-zinc-200 transition-colors text-center mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
