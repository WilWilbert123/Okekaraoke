// ============================================================
// OKEKARAOKE — Core Type Definitions
// ============================================================

// ─── Instance ────────────────────────────────────────────────
export type InstanceStatus = 'active' | 'paused' | 'closed' | 'expired';

export interface Instance {
  id: string;
  room_code: string;
  owner_session_id: string;
  status: InstanceStatus;
  created_at: string;
  updated_at: string;
}

// ─── Instance Settings ───────────────────────────────────────
export interface InstanceSettings {
  id: string;
  instance_id: string;
  max_queue_size: number;
  max_songs_per_guest: number;
  allow_duplicates: boolean;
  allow_cancel: boolean;
  allow_skip: boolean;
  autoplay: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Song ─────────────────────────────────────────────────────
export type SongType = 'Karaoke' | 'Minus One' | 'Duet' | 'Male Vocal' | 'Female Vocal' | 'Band';

export type SongCategory =
  | 'OPM'
  | 'English'
  | 'Korean'
  | 'Japanese'
  | 'Chinese'
  | 'Pop'
  | 'Rock'
  | 'Classic'
  | 'Love Songs'
  | 'Dance'
  | 'Christmas'
  | 'Oldies'
  | 'Recently Added'
  | 'Popular';

export interface Song {
  id: string;
  code: string;
  title: string;
  artist: string;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  category: SongCategory | null;
  language: string | null;
  song_type: SongType | null;
  keywords: string[];
  duration_seconds: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Queue ───────────────────────────────────────────────────
export type QueueItemStatus = 'queued' | 'playing' | 'completed' | 'cancelled' | 'skipped';

export interface QueueItem {
  id: string;
  instance_id: string;
  song_id: string;
  guest_session_id: string;
  guest_name: string | null;
  position: number;
  status: QueueItemStatus;
  reserved_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueItemWithSong extends QueueItem {
  song: Song;
}

// ─── Enriched Queue Item (from RPC) ──────────────────────────
export interface EnrichedQueueItem {
  queue_item_id: string;
  position: number;
  status: QueueItemStatus;
  guest_name: string | null;
  guest_session_id: string;
  reserved_at: string;
  started_at?: string | null;
  song: {
    id: string;
    code: string;
    title: string;
    artist: string;
    category?: string | null;
    youtube_video_id: string | null;
    thumbnail_url: string | null;
    duration_seconds: number | null;
  };
}

// ─── Device ───────────────────────────────────────────────────
export type DeviceType = 'tv' | 'remote' | 'admin';

export interface Device {
  id: string;
  instance_id: string;
  device_type: DeviceType;
  session_id: string;
  device_name: string | null;
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Instance State (from get_instance_state RPC) ────────────
export interface InstanceState {
  instance: {
    id: string;
    room_code: string;
    status: InstanceStatus;
    created_at: string;
  };
  settings: Omit<InstanceSettings, 'id' | 'instance_id' | 'created_at' | 'updated_at'>;
  current_song: EnrichedQueueItem | null;
  queue: EnrichedQueueItem[];
  devices: Partial<Device>[];
}

// ─── Reservation Log ─────────────────────────────────────────
export interface ReservationLog {
  id: string;
  instance_id: string;
  queue_item_id: string | null;
  guest_session_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Realtime Events ─────────────────────────────────────────
export type RealtimeEventType =
  | 'queue_added'
  | 'queue_removed'
  | 'queue_updated'
  | 'song_started'
  | 'song_finished'
  | 'song_skipped'
  | 'instance_updated'
  | 'tv_online'
  | 'tv_offline'
  | 'remote_joined'
  | 'remote_left'
  | 'banner_updated'
  | 'shoutout_broadcast'
  | 'playback_control';

export interface RealtimeEvent {
  type: RealtimeEventType;
  instance_id: string;
  room_code: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

// ─── API Responses ───────────────────────────────────────────
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateInstanceResponse {
  instance: Instance;
  room_code: string;
  session_id: string;
}

export interface ReserveResponse {
  queue_item_id: string;
  position: number;
}

export interface AdvanceQueueResponse {
  next_queue_item_id: string | null;
  next_song_id: string | null;
  next_youtube_video_id: string | null;
  next_guest_name: string | null;
  next_position: number | null;
}

// ─── YouTube ─────────────────────────────────────────────────
export interface YouTubeSearchResult {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
  duration: string | null;
}

// ─── Player State ────────────────────────────────────────────
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

export interface PlayerState {
  status: PlayerStatus;
  video_id: string | null;
  queue_item_id: string | null;
}

// ─── Guest Session ───────────────────────────────────────────
export interface GuestSession {
  session_id: string;
  guest_name: string | null;
  instance_id: string | null;
  room_code: string | null;
  device_type: DeviceType | null;
  created_at: string;
}

// ─── Connection Status ───────────────────────────────────────
export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';
