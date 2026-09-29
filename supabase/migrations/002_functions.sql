-- ============================================================
-- OKEKARAOKE: Stored Procedures & RPC Functions
-- Migration: 002_functions.sql
-- ============================================================

-- ============================================================
-- FUNCTION: reserve_song_atomic
-- Safely adds a song to the instance queue with atomic position
-- assignment. Prevents race conditions with concurrent reservations.
-- ============================================================
DROP FUNCTION IF EXISTS reserve_song_atomic(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION reserve_song_atomic(
  p_instance_id UUID,
  p_song_id UUID,
  p_guest_session_id TEXT,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  queue_item_id UUID,
  "position" INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance instances%ROWTYPE;
  v_settings instance_settings%ROWTYPE;
  v_song songs%ROWTYPE;
  v_queue_count INTEGER;
  v_guest_count INTEGER;
  v_already_reserved BOOLEAN;
  v_next_position INTEGER;
  v_queue_item_id UUID;
  v_position INTEGER;
BEGIN
  -- Lock the instance row to serialize concurrent reservations
  SELECT * INTO v_instance
  FROM instances
  WHERE id = p_instance_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'INSTANCE_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Get instance settings
  SELECT * INTO v_settings
  FROM instance_settings
  WHERE instance_id = p_instance_id;

  -- Use defaults if no settings row
  IF NOT FOUND THEN
    v_settings.max_queue_size := 30;
    v_settings.max_songs_per_guest := 5;
    v_settings.allow_duplicates := false;
    v_settings.allow_cancel := true;
    v_settings.allow_skip := false;
    v_settings.autoplay := true;
  END IF;

  -- Validate song exists and is active
  SELECT * INTO v_song
  FROM songs
  WHERE id = p_song_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'SONG_NOT_FOUND', 'The requested song was not found or is no longer available.', NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Count active items in queue for this instance
  SELECT COUNT(*) INTO v_queue_count
  FROM queue_items
  WHERE instance_id = p_instance_id
    AND status IN ('queued', 'playing');

  IF v_queue_count >= v_settings.max_queue_size THEN
    RETURN QUERY SELECT false, 'QUEUE_FULL', 'This room has reached its maximum queue size.', NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Count guest's active reservations
  SELECT COUNT(*) INTO v_guest_count
  FROM queue_items
  WHERE instance_id = p_instance_id
    AND guest_session_id = p_guest_session_id
    AND status IN ('queued', 'playing');

  IF v_guest_count >= v_settings.max_songs_per_guest THEN
    RETURN QUERY SELECT false, 'GUEST_LIMIT_REACHED', 'You have reached your maximum number of reserved songs.', NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  -- Check for duplicate if disallowed
  IF NOT v_settings.allow_duplicates THEN
    SELECT EXISTS (
      SELECT 1
      FROM queue_items
      WHERE instance_id = p_instance_id
        AND song_id = p_song_id
        AND guest_session_id = p_guest_session_id
        AND status IN ('queued', 'playing')
    ) INTO v_already_reserved;

    IF v_already_reserved THEN
      RETURN QUERY SELECT false, 'ALREADY_RESERVED', 'You have already reserved this song.', NULL::UUID, NULL::INTEGER;
      RETURN;
    END IF;
  END IF;

  -- Calculate next position atomically (global max + 1).
  -- Using ALL rows (not just active) so positions never repeat and the
  -- unique constraint on (instance_id, position, status) is never violated.
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM queue_items
  WHERE instance_id = p_instance_id;

  -- Insert the queue item
  INSERT INTO queue_items (
    instance_id,
    song_id,
    guest_session_id,
    guest_name,
    position,
    status,
    reserved_at
  ) VALUES (
    p_instance_id,
    p_song_id,
    p_guest_session_id,
    p_guest_name,
    v_next_position,
    'queued',
    NOW()
  )
  RETURNING id, position INTO v_queue_item_id, v_position;

  -- Log the reservation
  INSERT INTO reservation_logs (
    instance_id,
    queue_item_id,
    guest_session_id,
    action,
    metadata
  ) VALUES (
    p_instance_id,
    v_queue_item_id,
    p_guest_session_id,
    'reserved',
    jsonb_build_object(
      'song_id', p_song_id,
      'song_title', v_song.title,
      'song_artist', v_song.artist,
      'position', v_position
    )
  );

  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT, v_queue_item_id, v_position;
END;
$$;

-- ============================================================
-- FUNCTION: advance_queue_atomic
-- Marks current playing item as completed and starts the next one.
-- Called by TV when a song ends.
-- ============================================================
DROP FUNCTION IF EXISTS advance_queue_atomic(UUID, UUID);

CREATE OR REPLACE FUNCTION advance_queue_atomic(
  p_instance_id UUID,
  p_completed_queue_item_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  next_queue_item_id UUID,
  next_song_id UUID,
  next_youtube_video_id TEXT,
  next_guest_name TEXT,
  "next_position" INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_item queue_items%ROWTYPE;
  v_next_item queue_items%ROWTYPE;
  v_song songs%ROWTYPE;
BEGIN
  -- Lock instance
  PERFORM id FROM instances
  WHERE id = p_instance_id AND status = 'active'
  FOR UPDATE;

  -- Mark the specified or currently playing item as completed
  IF p_completed_queue_item_id IS NOT NULL THEN
    UPDATE queue_items
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_completed_queue_item_id
      AND instance_id = p_instance_id
      AND status = 'playing'
    RETURNING * INTO v_current_item;
  ELSE
    UPDATE queue_items
    SET status = 'completed', completed_at = NOW()
    WHERE instance_id = p_instance_id
      AND status = 'playing'
    RETURNING * INTO v_current_item;
  END IF;

  -- Find the next queued item (lowest position)
  SELECT * INTO v_next_item
  FROM queue_items
  WHERE instance_id = p_instance_id
    AND status = 'queued'
  ORDER BY position ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Start the next item
  UPDATE queue_items
  SET status = 'playing', started_at = NOW()
  WHERE id = v_next_item.id
  RETURNING * INTO v_next_item;

  -- Get song details
  SELECT * INTO v_song FROM songs WHERE id = v_next_item.song_id;

  -- Log the start
  INSERT INTO reservation_logs (
    instance_id,
    queue_item_id,
    guest_session_id,
    action,
    metadata
  ) VALUES (
    p_instance_id,
    v_next_item.id,
    v_next_item.guest_session_id,
    'started',
    jsonb_build_object(
      'song_id', v_song.id,
      'song_title', v_song.title,
      'position', v_next_item.position
    )
  );

  RETURN QUERY SELECT
    true,
    v_next_item.id,
    v_song.id,
    v_song.youtube_video_id,
    v_next_item.guest_name,
    v_next_item.position;
END;
$$;

-- ============================================================
-- FUNCTION: cancel_queue_item_atomic
-- Allows a guest to cancel their own queued (not playing) item.
-- ============================================================
DROP FUNCTION IF EXISTS cancel_queue_item_atomic(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION cancel_queue_item_atomic(
  p_instance_id UUID,
  p_queue_item_id UUID,
  p_guest_session_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item queue_items%ROWTYPE;
  v_settings instance_settings%ROWTYPE;
BEGIN
  -- Get settings
  SELECT * INTO v_settings FROM instance_settings WHERE instance_id = p_instance_id;

  IF FOUND AND NOT v_settings.allow_cancel THEN
    RETURN QUERY SELECT false, 'CANCEL_NOT_ALLOWED', 'Cancellation is not allowed in this room.';
    RETURN;
  END IF;

  -- Find and lock the item
  SELECT * INTO v_item
  FROM queue_items
  WHERE id = p_queue_item_id
    AND instance_id = p_instance_id
    AND guest_session_id = p_guest_session_id
    AND status = 'queued'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'ITEM_NOT_FOUND', 'This reservation was not found or cannot be cancelled.';
    RETURN;
  END IF;

  -- Cancel it
  UPDATE queue_items
  SET status = 'cancelled', cancelled_at = NOW()
  WHERE id = p_queue_item_id;

  -- Log
  INSERT INTO reservation_logs (
    instance_id,
    queue_item_id,
    guest_session_id,
    action,
    metadata
  ) VALUES (
    p_instance_id,
    p_queue_item_id,
    p_guest_session_id,
    'cancelled',
    jsonb_build_object('queue_item_id', p_queue_item_id)
  );

  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT;
END;
$$;

-- ============================================================
-- FUNCTION: skip_queue_item_atomic
-- Admin/TV can skip the currently playing item.
-- ============================================================
DROP FUNCTION IF EXISTS skip_queue_item_atomic(UUID, UUID);

CREATE OR REPLACE FUNCTION skip_queue_item_atomic(
  p_instance_id UUID,
  p_queue_item_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  next_queue_item_id UUID,
  next_song_id UUID,
  next_youtube_video_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_item queue_items%ROWTYPE;
  v_song songs%ROWTYPE;
BEGIN
  -- Lock instance
  PERFORM id FROM instances
  WHERE id = p_instance_id AND status = 'active'
  FOR UPDATE;

  -- Mark as skipped (ONLY if currently playing — never skip a queued item)
  UPDATE queue_items
  SET status = 'skipped', cancelled_at = NOW()
  WHERE id = p_queue_item_id
    AND instance_id = p_instance_id
    AND status = 'playing';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Find next queued item
  SELECT * INTO v_next_item
  FROM queue_items
  WHERE instance_id = p_instance_id
    AND status = 'queued'
  ORDER BY position ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, NULL::UUID, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Start it
  UPDATE queue_items
  SET status = 'playing', started_at = NOW()
  WHERE id = v_next_item.id
  RETURNING * INTO v_next_item;

  SELECT * INTO v_song FROM songs WHERE id = v_next_item.song_id;

  RETURN QUERY SELECT true, v_next_item.id, v_song.id, v_song.youtube_video_id;
END;
$$;

-- ============================================================
-- FUNCTION: generate_room_code
-- Generates a unique 4-character alphanumeric room code.
-- Retries until unique (collision-safe).
-- ============================================================
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_exists BOOLEAN;
  v_attempts INTEGER := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique room code after 100 attempts';
    END IF;

    -- Generate 4-char code (exclude O, I, 0, 1 for readability)
    v_code := '';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;

    -- Check uniqueness
    SELECT EXISTS (
      SELECT 1 FROM instances WHERE UPPER(room_code) = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- ============================================================
-- FUNCTION: get_instance_state
-- Returns the complete authoritative state for an instance.
-- Used by TV and remotes on reconnect/load.
-- ============================================================
CREATE OR REPLACE FUNCTION get_instance_state(p_room_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance instances%ROWTYPE;
  v_settings instance_settings%ROWTYPE;
  v_current_song JSONB;
  v_queue JSONB;
  v_devices JSONB;
BEGIN
  -- Get instance
  SELECT * INTO v_instance
  FROM instances
  WHERE UPPER(room_code) = UPPER(p_room_code)
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'INSTANCE_NOT_FOUND');
  END IF;

  -- Get settings
  SELECT * INTO v_settings FROM instance_settings WHERE instance_id = v_instance.id;

  -- Get current playing song
  SELECT jsonb_build_object(
    'queue_item_id', qi.id,
    'position', qi.position,
    'guest_name', qi.guest_name,
    'guest_session_id', qi.guest_session_id,
    'started_at', qi.started_at,
    'song', jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'title', s.title,
      'artist', s.artist,
      'youtube_video_id', s.youtube_video_id,
      'thumbnail_url', s.thumbnail_url,
      'duration_seconds', s.duration_seconds
    )
  ) INTO v_current_song
  FROM queue_items qi
  JOIN songs s ON s.id = qi.song_id
  WHERE qi.instance_id = v_instance.id
    AND qi.status = 'playing'
  ORDER BY qi.started_at DESC NULLS LAST, qi.position ASC
  LIMIT 1;

  -- Get queued items
  SELECT jsonb_agg(
    jsonb_build_object(
      'queue_item_id', qi.id,
      'position', qi.position,
      'guest_name', qi.guest_name,
      'guest_session_id', qi.guest_session_id,
      'reserved_at', qi.reserved_at,
      'song', jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'title', s.title,
        'artist', s.artist,
        'youtube_video_id', s.youtube_video_id,
        'thumbnail_url', s.thumbnail_url,
        'duration_seconds', s.duration_seconds
      )
    ) ORDER BY qi.position ASC
  ) INTO v_queue
  FROM queue_items qi
  JOIN songs s ON s.id = qi.song_id
  WHERE qi.instance_id = v_instance.id
    AND qi.status = 'queued';

  -- Get online devices
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'device_type', d.device_type,
      'device_name', d.device_name,
      'is_online', d.is_online,
      'last_seen_at', d.last_seen_at
    )
  ) INTO v_devices
  FROM devices d
  WHERE d.instance_id = v_instance.id
    AND d.is_online = true;

  RETURN jsonb_build_object(
    'instance', jsonb_build_object(
      'id', v_instance.id,
      'room_code', v_instance.room_code,
      'status', v_instance.status,
      'created_at', v_instance.created_at
    ),
    'settings', CASE WHEN v_settings IS NOT NULL THEN jsonb_build_object(
      'max_queue_size', v_settings.max_queue_size,
      'max_songs_per_guest', v_settings.max_songs_per_guest,
      'allow_duplicates', v_settings.allow_duplicates,
      'allow_cancel', v_settings.allow_cancel,
      'allow_skip', v_settings.allow_skip,
      'autoplay', v_settings.autoplay
    ) ELSE jsonb_build_object(
      'max_queue_size', 30,
      'max_songs_per_guest', 5,
      'allow_duplicates', false,
      'allow_cancel', true,
      'allow_skip', false,
      'autoplay', true
    ) END,
    'current_song', v_current_song,
    'queue', COALESCE(v_queue, '[]'::jsonb),
    'devices', COALESCE(v_devices, '[]'::jsonb)
  );
END;
$$;
