-- ============================================================
-- OKEKARAOKE: Banner Auto-Rotation & Multi-Preset Feature
-- Migration: 010_banner_rotation.sql
-- ============================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS banner_rotate_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_rotate_interval INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS banner_rotate_mode TEXT NOT NULL DEFAULT 'random',
  ADD COLUMN IF NOT EXISTS banner_pool JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banner_repeat_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS banner_max_cycles INTEGER NOT NULL DEFAULT 0;
