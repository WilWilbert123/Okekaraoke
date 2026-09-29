-- ============================================================
-- OKEKARAOKE: App Settings Table
-- Migration: 004_app_settings.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_settings',
  banner_enabled BOOLEAN NOT NULL DEFAULT false,
  banner_text TEXT NOT NULL DEFAULT 'Welcome to OKEKARAOKE! Scan the QR code to reserve your favorite songs.',
  banner_image_url TEXT NOT NULL DEFAULT '',
  banner_speed INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO app_settings (id, banner_enabled, banner_text, banner_image_url, banner_speed)
VALUES (
  'global_settings',
  false,
  'Welcome to OKEKARAOKE! Scan the QR code to reserve your favorite songs.',
  '',
  20
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security & Access Policies
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to app_settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to app_settings"
  ON app_settings FOR ALL
  USING (true)
  WITH CHECK (true);
