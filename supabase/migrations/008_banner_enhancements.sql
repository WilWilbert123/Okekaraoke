-- ============================================================
-- OKEKARAOKE: Banner Settings Enhancements
-- Migration: 008_banner_enhancements.sql
-- ============================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS banner_type TEXT NOT NULL DEFAULT 'ticker',
  ADD COLUMN IF NOT EXISTS banner_images JSONB NOT NULL DEFAULT '[]'::jsonb;
