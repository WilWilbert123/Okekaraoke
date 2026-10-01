// ============================================================
// OKEKARAOKE — POST /api/shoutout/send
// Validates, saves, and broadcasts real-time room shoutouts to TV
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, guest_name, guest_session_id, message } = body;

    if (!room_code || !message || typeof message !== 'string') {
      return apiError('VALIDATION_ERROR', 'Room code and message are required.', 400);
    }

    const trimmedRoom = String(room_code).toUpperCase().trim();
    // Enforce strict 50 character limit for clean TV floating display
    const cleanMessage = String(message).trim().slice(0, 50);

    if (!cleanMessage) {
      return apiError('VALIDATION_ERROR', 'Message cannot be empty.', 400);
    }

    const supabase = createAdminClient();

    // 1. Check if shoutouts are enabled in global settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('shoutout_enabled')
      .maybeSingle();

    if (settings && settings.shoutout_enabled === false) {
      return apiError('DISABLED', 'Shoutouts are currently disabled by TV Admin.', 403);
    }

    const name = String(guest_name || 'Singer').trim().slice(0, 30);
    const sessionId = String(guest_session_id || 'guest-anon');

    // 2. Insert shoutout record into DB (for admin monitoring & history)
    const { data: inserted, error: insertError } = await supabase
      .from('room_shoutouts')
      .insert({
        room_code: trimmedRoom,
        guest_name: name,
        guest_session_id: sessionId,
        message: cleanMessage,
      })
      .select()
      .single();

    if (insertError) {
      console.warn('DB insert error for shoutout (will still broadcast):', insertError.message);
    }

    const shoutoutPayload = {
      id: inserted?.id || `so-${Date.now()}`,
      room_code: trimmedRoom,
      guest_name: name,
      message: cleanMessage,
      sent_at: Date.now(),
    };

    // 3. Broadcast real-time event directly to room's TV screen
    await supabase.channel(`okekaraoke:instance:${trimmedRoom}`).send({
      type: 'broadcast',
      event: 'shoutout_broadcast',
      payload: shoutoutPayload,
    });

    // 4. Also broadcast to global channel for admin live monitoring
    await supabase.channel('okekaraoke:global').send({
      type: 'broadcast',
      event: 'shoutout_broadcast',
      payload: shoutoutPayload,
    });

    return apiSuccess(shoutoutPayload);
  } catch (error) {
    console.error('Error sending shoutout:', error);
    return apiError('INTERNAL_ERROR', 'Failed to send shoutout.', 500);
  }
}
