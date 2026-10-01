// ============================================================
// OKEKARAOKE — DELETE /api/admin/rooms
// Admin: Kill / close a specific karaoke room or kill all offline/idle rooms
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('room_code');
    const killAllOffline = searchParams.get('kill_all_offline') === 'true' || searchParams.get('kill_idle') === 'true';

    const supabase = createAdminClient();

    // OPTION 1: Kill all offline / idle rooms in bulk
    if (killAllOffline) {
      // 1. Fetch active devices to get online instance IDs
      const cutoff = new Date(Date.now() - 45000).toISOString();
      const { data: onlineDevices } = await supabase
        .from('devices')
        .select('instance_id')
        .eq('is_online', true)
        .gte('last_seen_at', cutoff);

      const onlineInstanceIds = new Set((onlineDevices || []).map((d) => d.instance_id));

      // 2. Fetch all active instances
      const { data: activeInstances } = await supabase
        .from('instances')
        .select('id, room_code')
        .eq('status', 'active');

      const idleInstances = (activeInstances || []).filter((inst) => !onlineInstanceIds.has(inst.id));

      if (idleInstances.length === 0) {
        return apiSuccess({ message: 'No offline/idle rooms found to terminate.', count: 0 });
      }

      const idleIds = idleInstances.map((inst) => inst.id);
      const idleCodes = idleInstances.map((inst) => inst.room_code.toUpperCase());

      // 3. Clear queue items for all idle rooms
      await supabase
        .from('queue_items')
        .delete()
        .in('instance_id', idleIds);

      // 4. Update status to 'closed' for all idle instances
      await supabase
        .from('instances')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .in('id', idleIds);

      // 5. Mark devices as offline
      await supabase
        .from('devices')
        .update({ is_online: false })
        .in('instance_id', idleIds);

      // Broadcast kill event
      for (const code of idleCodes) {
        try {
          await supabase.channel(`okekaraoke:instance:${code}`).send({
            type: 'broadcast',
            event: 'instance_updated',
            payload: { type: 'instance_updated', status: 'closed', room_code: code, reason: 'Admin terminated offline session.' },
          });
        } catch {}
      }

      return apiSuccess({
        message: `Successfully terminated ${idleInstances.length} offline/idle rooms (${idleCodes.join(', ')}).`,
        count: idleInstances.length,
        terminated_rooms: idleCodes,
      });
    }

    // OPTION 2: Kill a single room by room_code
    if (!roomCode) {
      return apiError('MISSING_ROOM', 'room_code or kill_all_offline=true is required.', 400);
    }

    const normalizedCode = roomCode.trim().toUpperCase();

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

    // 3. Update status to 'closed'
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

    // 5. Broadcast kill signal
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
