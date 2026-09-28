-- ============================================================
-- OKEKARAOKE: Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- INSTANCES TABLE
-- Each row is an independent OKEKARAOKE session/room
-- ============================================================
CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) NOT NULL UNIQUE,
  owner_session_id TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instances_room_code ON instances (UPPER(room_code));
CREATE INDEX idx_instances_status ON instances (status);
CREATE INDEX idx_instances_owner_session_id ON instances (owner_session_id);

-- ============================================================
-- SONGS TABLE
-- Central catalog of all karaoke songs
-- ============================================================
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  youtube_video_id TEXT,
  thumbnail_url TEXT,
  category VARCHAR(50),
  language VARCHAR(50),
  song_type VARCHAR(50),
  keywords TEXT[],
  duration_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_songs_code ON songs (code);
CREATE INDEX idx_songs_title ON songs USING gin(to_tsvector('english', title));
CREATE INDEX idx_songs_artist ON songs USING gin(to_tsvector('english', artist));
CREATE INDEX idx_songs_is_active ON songs (is_active);
CREATE INDEX idx_songs_category ON songs (category);
CREATE INDEX idx_songs_language ON songs (language);
CREATE INDEX idx_songs_keywords ON songs USING gin(keywords);

-- ============================================================
-- QUEUE ITEMS TABLE
-- Each row is a song reservation in a specific instance
-- instance_id is MANDATORY on every row
-- ============================================================
CREATE TABLE queue_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id),
  guest_session_id TEXT NOT NULL,
  guest_name TEXT,
  position INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'completed', 'cancelled', 'skipped')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, position, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_queue_items_instance_id ON queue_items (instance_id);
CREATE INDEX idx_queue_items_instance_status ON queue_items (instance_id, status);
CREATE INDEX idx_queue_items_instance_position ON queue_items (instance_id, position);
CREATE INDEX idx_queue_items_guest_session ON queue_items (instance_id, guest_session_id);
CREATE INDEX idx_queue_items_song_id ON queue_items (song_id);

-- ============================================================
-- DEVICES TABLE
-- Tracks TV, phone remotes, and admin connections per instance
-- ============================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('tv', 'remote', 'admin')),
  session_id TEXT NOT NULL,
  device_name TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, session_id)
);

CREATE INDEX idx_devices_instance_id ON devices (instance_id);
CREATE INDEX idx_devices_session_id ON devices (session_id);
CREATE INDEX idx_devices_instance_type ON devices (instance_id, device_type);
CREATE INDEX idx_devices_is_online ON devices (instance_id, is_online);

-- ============================================================
-- INSTANCE SETTINGS TABLE
-- Per-instance configuration
-- ============================================================
CREATE TABLE instance_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL UNIQUE REFERENCES instances(id) ON DELETE CASCADE,
  max_queue_size INTEGER NOT NULL DEFAULT 30,
  max_songs_per_guest INTEGER NOT NULL DEFAULT 5,
  allow_duplicates BOOLEAN NOT NULL DEFAULT false,
  allow_cancel BOOLEAN NOT NULL DEFAULT true,
  allow_skip BOOLEAN NOT NULL DEFAULT false,
  autoplay BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instance_settings_instance_id ON instance_settings (instance_id);

-- ============================================================
-- RESERVATION LOGS TABLE
-- Audit trail for all reservation actions
-- instance_id is MANDATORY on every row
-- ============================================================
CREATE TABLE reservation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES queue_items(id) ON DELETE SET NULL,
  guest_session_id TEXT NOT NULL,
  action VARCHAR(50) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservation_logs_instance_id ON reservation_logs (instance_id);
CREATE INDEX idx_reservation_logs_queue_item_id ON reservation_logs (queue_item_id);
CREATE INDEX idx_reservation_logs_guest_session ON reservation_logs (instance_id, guest_session_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_instances_updated_at
  BEFORE UPDATE ON instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_items_updated_at
  BEFORE UPDATE ON queue_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instance_settings_updated_at
  BEFORE UPDATE ON instance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_logs ENABLE ROW LEVEL SECURITY;

-- Songs: publicly readable (catalog), only service role can write
CREATE POLICY "songs_select_policy" ON songs
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "songs_all_service_policy" ON songs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Instances: readable by anon (to join rooms), service role manages
CREATE POLICY "instances_select_policy" ON instances
  FOR SELECT TO anon, authenticated USING (status = 'active');

CREATE POLICY "instances_all_service_policy" ON instances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Queue items: readable/writeable via service role only (API validates)
CREATE POLICY "queue_items_select_policy" ON queue_items
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "queue_items_all_service_policy" ON queue_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Devices: service role manages
CREATE POLICY "devices_select_policy" ON devices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "devices_all_service_policy" ON devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Instance settings: readable by all, writeable by service role
CREATE POLICY "instance_settings_select_policy" ON instance_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "instance_settings_all_service_policy" ON instance_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reservation logs: service role only
CREATE POLICY "reservation_logs_select_policy" ON reservation_logs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "reservation_logs_all_service_policy" ON reservation_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
