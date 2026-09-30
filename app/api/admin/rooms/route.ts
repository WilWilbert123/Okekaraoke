// ============================================================
// OKEKARAOKE — DELETE /api/admin/rooms
// Admin: Kill / close a specific karaoke room & clear its queue
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('room_code');

    if (!roomCode) {
      return apiError('MISSING_ROOM', 'room_code is required.', 400);
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const supabase = createAdminClient();

    // 1. Get the instance record
    const { data: instance } = await supabase
      .from('instances')
      .select('id, room_code')
      .ilike('room_code', normalizedCode)
      .maybeSingle();

    if (!instance) {
      return apiError('NOT_FOUND', 'Room not found.', 404);
    }

    // 2. Clear the queue for this room
    await supabase
      .from('queue_items')
      .delete()
      .eq('instance_id', instance.id);

    // 3. Update status to 'closed' (matches database check constraint)
    const { error: updateError } = await supabase
      .from('instances')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', instance.id);

    if (updateError) {
      console.error('Failed to update instance status to closed:', updateError);
    }

    // 4. Mark all connected devices offline for this room
    await supabase
      .from('devices')
      .update({ is_online: false })
      .eq('instance_id', instance.id);

    // 5. Broadcast kill signal to room channel so TV and remotes disconnect immediately
    const roomChannelName = `okekaraoke:instance:${normalizedCode}`;
    await supabase.channel(roomChannelName).send({
      type: 'broadcast',
      event: 'instance_updated',
      payload: { type: 'instance_updated', status: 'closed', room_code: normalizedCode, reason: 'Admin terminated session.' },
    });

    await supabase.channel('okekaraoke:global').send({
      type: 'broadcast',
      event: 'instance_updated',
      payload: { type: 'instance_updated', status: 'closed', room_code: normalizedCode },
    });

    return apiSuccess({ message: `Room ${normalizedCode} has been terminated.` });
  } catch (error) {
    console.error('Error killing room:', error);
    return apiError('INTERNAL_ERROR', 'Failed to kill room.', 500);
  }
}
