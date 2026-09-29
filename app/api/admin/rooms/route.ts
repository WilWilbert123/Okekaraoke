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

    const supabase = createAdminClient();

    // 1. Get the instance record
    const { data: instance } = await supabase
      .from('instances')
      .select('id, room_code')
      .eq('room_code', roomCode.toUpperCase())
      .maybeSingle();

    if (!instance) {
      return apiError('NOT_FOUND', 'Room not found.', 404);
    }

    // 2. Clear the queue for this room
    await supabase
      .from('queue_items')
      .delete()
      .eq('instance_id', instance.id);

    // 3. Set instance to inactive
    await supabase
      .from('instances')
      .update({ status: 'inactive', ended_at: new Date().toISOString() })
      .eq('id', instance.id);

    // 4. Broadcast kill signal to room channel and global channel so TV and remotes disconnect immediately
    const roomChannelName = `okekaraoke:instance:${roomCode.toUpperCase()}`;
    await supabase.channel(roomChannelName).send({
      type: 'broadcast',
      event: 'instance_updated',
      payload: { type: 'instance_updated', status: 'inactive', room_code: roomCode.toUpperCase(), reason: 'Admin terminated session.' },
    });

    await supabase.channel('okekaraoke:global').send({
      type: 'broadcast',
      event: 'instance_updated',
      payload: { type: 'instance_updated', status: 'inactive', room_code: roomCode.toUpperCase() },
    });

    return apiSuccess({ message: `Room ${roomCode.toUpperCase()} has been terminated.` });
  } catch (error) {
    console.error('Error killing room:', error);
    return apiError('INTERNAL_ERROR', 'Failed to kill room.', 500);
  }
}
