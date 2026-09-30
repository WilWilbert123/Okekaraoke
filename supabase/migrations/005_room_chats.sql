-- ============================================================
-- OKEKARAOKE: Room Chats Table
-- Migration: 005_room_chats.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS room_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) NOT NULL,
  sender_name TEXT NOT NULL,
  sender_session_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_chats_room_code ON room_chats (UPPER(room_code), created_at ASC);

-- Enable RLS
ALTER TABLE room_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to room_chats"
  ON room_chats FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to room_chats"
  ON room_chats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to room_chats"
  ON room_chats FOR ALL
  USING (true)
  WITH CHECK (true);
