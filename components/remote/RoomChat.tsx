'use client';

// ============================================================
// OKEKARAOKE — Room Chat Component
// Real-time in-room group chat with persistent database storage
// & local storage fallback so messages stay across page refreshes.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, Users, Smile, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatMessage {
  id: string;
  sender_name: string;
  sender_session_id: string;
  text: string;
  sent_at: number; // unix ms
  reactions?: Record<string, { count: number; users: { name: string; session_id: string }[] }>;
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
  onNewMessage?: () => void;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper to filter out duplicate IDs or duplicate content sent within 5s window
function deduplicateMessages(msgs: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  const seenFingerprints = new Set<string>();
  const result: ChatMessage[] = [];

  for (const m of msgs) {
    if (!m || !m.text) continue;

    // 1. Check ID uniqueness
    if (map.has(m.id)) continue;
    map.set(m.id, m);

    // 2. Content fingerprint (sender_session_id + text + timestamp rounded to 5 seconds)
    const timeBucket = Math.floor((m.sent_at || 0) / 5000);
    const fingerprint = `${m.sender_session_id}_${m.text.trim()}_${timeBucket}`;
    if (seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);

    result.push(m);
  }

  return result.sort((a, b) => a.sent_at - b.sent_at);
}

export function RoomChat({ roomCode, sessionId, guestName, onlineUsers: parentOnlineUsers, onNewMessage }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [reactionModal, setReactionModal] = useState<{emoji: string, users: {name: string, session_id: string}[]} | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const supabase = createClient();

  const storageKey = `okekaraoke_chat_${roomCode.toUpperCase()}`;

  // Helper to save messages to local storage
  const saveToLocalStorage = useCallback((msgs: ChatMessage[]) => {
    try {
      if (typeof window !== 'undefined') {
        const clean = deduplicateMessages(msgs);
        localStorage.setItem(storageKey, JSON.stringify(clean.slice(-150)));
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
            setMessages(deduplicateMessages(parsed));
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
            const merged = deduplicateMessages([...prev, ...json.messages]);
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
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleExpandReactions = useCallback((msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  // ── 2. Subscribe to room broadcast chat channel ──────────────
  useEffect(() => {
    const channelName = `okekaraoke:chat:${roomCode.toUpperCase()}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true }, presence: { key: sessionId } },
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => {
          const merged = deduplicateMessages([...prev, msg]);
          saveToLocalStorage(merged);
          return merged;
        });
        if (msg.sender_session_id !== sessionId) {
          onNewMessage?.();
        }
      })
      .on('broadcast', { event: 'chat_reaction_sync' }, ({ payload }) => {
        setMessages((prev) => {
          const updated = prev.map(msg => {
            if (msg.id === payload.messageId) {
              return { ...msg, reactions: payload.reactions };
            }
            return msg;
          });
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

  const messagesListRef = useRef<HTMLDivElement>(null);

  // ── Auto-scroll to bottom when new messages arrive ───────
  useEffect(() => {
    if (messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
  }, [messages.length]);

  // ── 3. Send a message ─────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const displayName = guestName?.trim() || 'Guest';
    const msgId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newMsg: ChatMessage = {
      id: msgId,
      sender_name: displayName,
      sender_session_id: sessionId,
      text,
      sent_at: Date.now(),
    };

    setSending(true);
    setInput('');

    // Optimistically update local state & localStorage
    setMessages((prev) => {
      const merged = deduplicateMessages([...prev, newMsg]);
      saveToLocalStorage(merged);
      return merged;
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

      // Persist message to database via API using the same msgId
      await fetch(`/api/instances/${roomCode}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: msgId,
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

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    setActiveReactionPicker(null);
    const user = { name: guestName || 'Guest', session_id: sessionId };
    
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const reactions = msg.reactions ? { ...msg.reactions } : {};
    let removedFromOtherEmoji = false;
    for (const key of Object.keys(reactions)) {
      if (key !== emoji) {
        const group = reactions[key];
        const hasReacted = group.users.some(u => u.session_id === user.session_id);
        if (hasReacted) {
          const newUsers = group.users.filter(u => u.session_id !== user.session_id);
          const newCount = Math.max(0, group.count - 1);
          if (newCount === 0) {
            delete reactions[key];
          } else {
            reactions[key] = { ...group, users: newUsers, count: newCount };
          }
          removedFromOtherEmoji = true;
        }
      }
    }

    const reactionGroup = reactions[emoji] 
      ? { ...reactions[emoji], users: [...reactions[emoji].users] } 
      : { count: 0, users: [] };
    
    const hasReacted = reactionGroup.users.some(u => u.session_id === user.session_id);
    if (hasReacted) {
      reactionGroup.users = reactionGroup.users.filter(u => u.session_id !== user.session_id);
      reactionGroup.count = Math.max(0, reactionGroup.count - 1);
    } else {
      reactionGroup.users.push(user);
      reactionGroup.count += 1;
    }
    
    if (reactionGroup.count === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = reactionGroup;
    }

    setMessages((prev) => {
      const updated = prev.map(m => {
        if (m.id === messageId) {
          return { ...m, reactions };
        }
        return m;
      });
      saveToLocalStorage(updated);
      return updated;
    });

    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat_reaction_sync',
          payload: { messageId, reactions },
        });
      } catch (e) {
        console.warn('Failed to broadcast reaction', e);
      }
    }
  }, [messages, guestName, sessionId, saveToLocalStorage]);

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
      <div ref={messagesListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
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

              {/* Bubble & Picker Container */}
              <div className="relative max-w-[80%]">
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setActiveReactionPicker(activeReactionPicker === msg.id ? null : msg.id);
                  }}
                  onClick={() => setActiveReactionPicker(null)}
                  className="px-3 py-2 rounded-2xl text-sm leading-snug break-words select-none transition-transform active:scale-[0.98]"
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

                {/* Reaction Picker Popover */}
                {activeReactionPicker === msg.id && (
                  <div 
                    className={`absolute z-20 ${isMe ? 'right-0' : 'left-0'} top-full mt-1 p-1.5 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl flex gap-1 animate-fadeIn`}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {['👍', '❤️', '😂', '🔥', '🎉'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(msg.id, emoji);
                          setActiveReactionPicker(null);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-700 rounded-lg active:scale-90 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reactions Badges */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (() => {
                const reactionEntries = Object.entries(msg.reactions);
                const isExpanded = expandedMessages.has(msg.id);
                const visibleReactions = isExpanded ? reactionEntries : reactionEntries.slice(0, 3);
                const hiddenCount = reactionEntries.length - visibleReactions.length;
                
                return (
                  <div className={`flex items-center flex-wrap gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {visibleReactions.map(([emoji, data]) => {
                      const hasMyReact = data.users.some(u => u.session_id === sessionId);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setReactionModal({ emoji, users: data.users });
                          }}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold border transition-all active:scale-90 ${
                            hasMyReact 
                              ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' 
                              : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300'
                          }`}
                        >
                          <span className="text-[12px]">{emoji}</span>
                          <span className="opacity-90">{data.count}</span>
                        </button>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <button
                        onClick={() => toggleExpandReactions(msg.id)}
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>
                );
              })()}
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

      {/* Reaction Details Modal */}
      {reactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setReactionModal(null)}>
          <div
            className="relative w-full max-w-xs bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 text-left"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{reactionModal.emoji}</span>
                <span className="text-sm font-black text-white">
                  Reactions ({reactionModal.users.length})
                </span>
              </div>
              <button
                onClick={() => setReactionModal(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pt-2">
              {reactionModal.users.map((u, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800/50 text-sm">
                  <span className="font-medium text-zinc-200 truncate">{u.name}</span>
                  {u.session_id === sessionId && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-300">YOU</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
