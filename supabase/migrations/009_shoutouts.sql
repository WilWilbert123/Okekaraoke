-- ============================================================
-- OKEKARAOKE: Live TV Shoutout System
-- Migration: 009_shoutouts.sql
-- ============================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS shoutout_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS room_shoutouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT 'Singer',
  guest_session_id TEXT NOT NULL,
  message VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_shoutouts_room_code ON room_shoutouts (room_code, created_at DESC);

ALTER TABLE room_shoutouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to room_shoutouts"
  ON room_shoutouts FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to room_shoutouts"
  ON room_shoutouts FOR ALL
  USING (true)
  WITH CHECK (true);
