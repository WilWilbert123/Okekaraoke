// ============================================================
// OKEKARAOKE — DELETE /api/admin/rooms
// Admin: Kill & delete a specific room or kill all offline/idle rooms from Supabase
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

    // OPTION 1: Kill all offline / idle rooms in bulk and DELETE from Supabase
    if (killAllOffline) {
      // 1. Fetch active devices to get online instance IDs
      const cutoff = new Date(Date.now() - 45000).toISOString();
      const { data: onlineDevices } = await supabase
        .from('devices')
        .select('instance_id')
        .eq('is_online', true)
        .gte('last_seen_at', cutoff);

      const onlineInstanceIds = new Set((onlineDevices || []).map((d) => d.instance_id).filter(Boolean));

      // 2. Fetch all instances in the database
      const { data: allInstances } = await supabase
        .from('instances')
        .select('id, room_code, status');

      // Idle/offline instances are instances whose status is 'closed' OR which have no active online devices
      const idleInstances = (allInstances || []).filter(
        (inst) => inst.status === 'closed' || !onlineInstanceIds.has(inst.id)
      );

      if (idleInstances.length === 0) {
        return apiSuccess({ message: 'No offline/idle rooms found to terminate.', count: 0 });
      }

      const idleIds = idleInstances.map((inst) => inst.id);
      const idleCodes = idleInstances.map((inst) => inst.room_code.toUpperCase());

      // 3. Broadcast kill event to rooms before deleting
      for (const code of idleCodes) {
        try {
          await supabase.channel(`okekaraoke:instance:${code}`).send({
            type: 'broadcast',
            event: 'instance_updated',
            payload: { type: 'instance_updated', status: 'closed', room_code: code, reason: 'Admin terminated offline session.' },
          });
        } catch {}
      }

      // 4. Delete all dependent child records
      await supabase.from('queue_items').delete().in('instance_id', idleIds);
      await supabase.from('instance_settings').delete().in('instance_id', idleIds);
      await supabase.from('devices').delete().in('instance_id', idleIds);
      await supabase.from('room_chats').delete().in('room_code', idleCodes);
      await supabase.from('room_shoutouts').delete().in('room_code', idleCodes);

      // 5. DELETE instance records directly from Supabase
      const { error: deleteError } = await supabase
        .from('instances')
        .delete()
        .in('id', idleIds);

      if (deleteError) {
        console.error('Failed to delete idle instances from DB:', deleteError);
      }

      return apiSuccess({
        message: `Successfully deleted ${idleInstances.length} offline/idle room records from Supabase (${idleCodes.join(', ')}).`,
        count: idleInstances.length,
        terminated_rooms: idleCodes,
      });
    }

    // OPTION 2: Kill & delete a single room by room_code
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

    // 2. Broadcast kill signal first
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

    // 3. Delete all dependent child records
    await supabase.from('queue_items').delete().eq('instance_id', instance.id);
    await supabase.from('instance_settings').delete().eq('instance_id', instance.id);
    await supabase.from('devices').delete().eq('instance_id', instance.id);
    await supabase.from('room_chats').delete().eq('room_code', normalizedCode);
    await supabase.from('room_shoutouts').delete().eq('room_code', normalizedCode);

    // 4. DELETE instance record directly from Supabase
    const { error: deleteError } = await supabase
      .from('instances')
      .delete()
      .eq('id', instance.id);

    if (deleteError) {
      console.error('Failed to delete instance from DB:', deleteError);
    }

    return apiSuccess({ message: `Room ${normalizedCode} has been deleted from Supabase.` });
  } catch (error) {
    console.error('Error killing room:', error);
    return apiError('INTERNAL_ERROR', 'Failed to kill room.', 500);
  }
}
