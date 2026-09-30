-- ============================================================
-- OKEKARAOKE: Feedbacks & Bug Reports Schema
-- Migration: 007_feedbacks.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'feedback', -- 'feedback', 'bug', 'song_request'
  message TEXT NOT NULL,
  guest_name TEXT,
  room_code TEXT,
  status TEXT NOT NULL DEFAULT 'unread', -- 'unread', 'read', 'resolved'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks (status);

-- Enable RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Allow public insertion (guests sending feedback)
CREATE POLICY "Allow public insert on feedbacks"
  ON feedbacks FOR INSERT
  WITH CHECK (true);

-- Allow public select & update
CREATE POLICY "Allow public select on feedbacks"
  ON feedbacks FOR SELECT
  USING (true);

CREATE POLICY "Allow public update on feedbacks"
  ON feedbacks FOR UPDATE
  USING (true);
