-- ============================================================
-- OKEKARAOKE: Admin & User Support Chat Schema
-- Migration: 010_admin_support_chats.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_support_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedbacks(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for real-time querying by session or feedback thread
CREATE INDEX IF NOT EXISTS idx_admin_support_chats_session ON admin_support_chats (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_admin_support_chats_feedback ON admin_support_chats (feedback_id, created_at ASC);

-- Enable RLS
ALTER TABLE admin_support_chats ENABLE ROW LEVEL SECURITY;

-- Allow public read & insert (guests and admin can read & chat)
CREATE POLICY "Allow public select on admin_support_chats"
  ON admin_support_chats FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on admin_support_chats"
  ON admin_support_chats FOR INSERT
  WITH CHECK (true);

-- Enable Realtime publication for admin_support_chats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'admin_support_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE admin_support_chats;
  END IF;
END $$;
