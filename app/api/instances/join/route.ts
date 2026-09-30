// ============================================================
// OKEKARAOKE — POST /api/instances/join
// Joins an existing instance as a remote or other device type
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateRoomCode, validateSessionId } from '@/lib/utils/apiHelpers';
import type { DeviceType } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { room_code, guest_session_id, device_type = 'remote', guest_name } = body;

    if (!room_code) {
      return apiError('MISSING_ROOM_CODE', 'Room code is required.', 400);
    }

    const normalizedCode = validateRoomCode(room_code);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    if (!guest_session_id || !validateSessionId(guest_session_id)) {
      return apiError('INVALID_SESSION', 'A valid guest session ID is required.', 400);
    }

    const validDeviceTypes: DeviceType[] = ['tv', 'remote', 'admin'];
    if (!validDeviceTypes.includes(device_type)) {
      return apiError('INVALID_DEVICE_TYPE', 'Invalid device type.', 400);
    }

    const supabase = createAdminClient();

    // Find active instance
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*')
      .eq('status', 'active')
      .ilike('room_code', normalizedCode)
      .single();

    if (instanceError || !instance) {
      return apiError('ROOM_NOT_FOUND', 'This OKEKARAOKE room does not exist or is no longer active.', 404);
    }

    // Extract location info
    const { extractLocationFromRequest } = await import('@/lib/utils/location');
    const loc = extractLocationFromRequest(request);
    const clientCity = body.city || loc.city;
    const clientCountry = body.country || loc.country;

    // Upsert device record (handles reconnects)
    const { error: deviceError } = await supabase
      .from('devices')
      .upsert({
        instance_id: instance.id,
        device_type,
        session_id: guest_session_id,
        device_name: guest_name ?? `${device_type} device`,
        is_online: true,
        city: clientCity,
        country: clientCountry,
        ip_address: loc.ip,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'instance_id,session_id',
      });

    if (deviceError) {
      console.error('Device upsert failed:', deviceError);
    }

    return apiSuccess({
      instance,
      room_code: instance.room_code,
      session_id: guest_session_id,
    });
  } catch (error) {
    console.error('Unexpected error in /api/instances/join:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
