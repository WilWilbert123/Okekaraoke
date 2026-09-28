// ============================================================
// OKEKARAOKE — Supabase Database Types
// Manually typed to avoid needing supabase gen types
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      instances: {
        Row: {
          id: string;
          room_code: string;
          owner_session_id: string;
          status: 'active' | 'paused' | 'closed' | 'expired';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['instances']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['instances']['Insert']>;
      };
      instance_settings: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['instance_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['instance_settings']['Insert']>;
      };
      songs: {
        Row: {
          id: string;
          code: string;
          title: string;
          artist: string;
          youtube_video_id: string | null;
          thumbnail_url: string | null;
          category: string | null;
          language: string | null;
          song_type: string | null;
          keywords: string[];
          duration_seconds: number | null;
          is_active: boolean;
          play_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['songs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['songs']['Insert']>;
      };
      queue_items: {
        Row: {
          id: string;
          instance_id: string;
          song_id: string;
          guest_session_id: string;
          guest_name: string | null;
          position: number;
          status: 'queued' | 'playing' | 'completed' | 'cancelled' | 'skipped';
          reserved_at: string;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['queue_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['queue_items']['Insert']>;
      };
      devices: {
        Row: {
          id: string;
          instance_id: string;
          device_type: 'tv' | 'remote' | 'admin';
          session_id: string;
          device_name: string | null;
          is_online: boolean;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['devices']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['devices']['Insert']>;
      };
      reservation_logs: {
        Row: {
          id: string;
          instance_id: string;
          queue_item_id: string | null;
          guest_session_id: string;
          action: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reservation_logs']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
    Functions: {
      generate_room_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_instance_state: {
        Args: { p_instance_id: string };
        Returns: {
          instance: Json;
          settings: Json;
          current_song: Json | null;
          queue: Json;
          devices: Json;
        };
      };
      reserve_song_atomic: {
        Args: {
          p_instance_id: string;
          p_song_id: string;
          p_guest_session_id: string;
          p_guest_name: string | null;
        };
        Returns: {
          success: boolean;
          queue_item_id: string | null;
          position: number | null;
          error_code: string | null;
          error_message: string | null;
        };
      };
      advance_queue_atomic: {
        Args: {
          p_instance_id: string;
          p_completed_queue_item_id: string;
        };
        Returns: {
          success: boolean;
          next_queue_item_id: string | null;
          next_song_id: string | null;
          next_youtube_video_id: string | null;
          next_guest_name: string | null;
          next_position: number | null;
        };
      };
      cancel_queue_item_atomic: {
        Args: {
          p_instance_id: string;
          p_queue_item_id: string;
          p_guest_session_id: string;
        };
        Returns: {
          success: boolean;
          instance_id: string | null;
          room_code: string | null;
          error_code: string | null;
          error_message: string | null;
        };
      };
      skip_queue_item_atomic: {
        Args: {
          p_instance_id: string;
          p_queue_item_id: string;
        };
        Returns: {
          success: boolean;
          next_queue_item_id: string | null;
          next_youtube_video_id: string | null;
        };
      };
    };
    Enums: Record<string, never>;
  };
}
