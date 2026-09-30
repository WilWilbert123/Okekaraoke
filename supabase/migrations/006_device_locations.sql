-- ============================================================
-- OKEKARAOKE: Device & Instance Location Tracking
-- Migration: 006_device_locations.sql
-- ============================================================

ALTER TABLE devices ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Local Area';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Philippines';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT '';

ALTER TABLE instances ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Local Area';
ALTER TABLE instances ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Philippines';
ALTER TABLE instances ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT '';
