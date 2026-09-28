// ============================================================
// OKEKARAOKE — POST /api/instances/create
// Creates a new OKEKARAOKE instance with a unique room code
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateSessionId } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { guest_session_id, guest_name } = body;

    if (!guest_session_id || !validateSessionId(guest_session_id)) {
      return apiError('INVALID_SESSION', 'A valid guest session ID is required.', 400);
    }

    const supabase = createAdminClient();

    // Generate unique room code via DB function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_room_code');

    if (codeError || !codeData) {
      console.error('Room code generation failed:', codeError);
      return apiError('CODE_GENERATION_FAILED', 'Failed to generate room code. Please try again.', 500);
    }

    const room_code = codeData as string;

    // Create instance
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .insert({
        room_code,
        owner_session_id: guest_session_id,
        status: 'active',
      })
      .select()
      .single();

    if (instanceError || !instance) {
      console.error('Instance creation failed:', instanceError);
      return apiError('INSTANCE_CREATE_FAILED', 'Failed to create OKEKARAOKE room. Please try again.', 500);
    }

    // Create default instance settings
    await supabase.from('instance_settings').insert({
      instance_id: instance.id,
      max_queue_size: 30,
      max_songs_per_guest: 5,
      allow_duplicates: false,
      allow_cancel: true,
      allow_skip: false,
      autoplay: true,
    });

    // Register TV device (the creator becomes the TV)
    await supabase.from('devices').insert({
      instance_id: instance.id,
      device_type: 'tv',
      session_id: guest_session_id,
      device_name: 'Main TV',
      is_online: true,
      last_seen_at: new Date().toISOString(),
    });

    return apiSuccess({
      instance,
      room_code,
      session_id: guest_session_id,
    }, 201);
  } catch (error) {
    console.error('Unexpected error in /api/instances/create:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
