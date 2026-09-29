// ============================================================
// OKEKARAOKE — POST /api/queue/cancel
// Cancels a guest's own queued reservation
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError, validateSessionId, validateUUID } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { queue_item_id, guest_session_id } = body;

    if (!queue_item_id || !validateUUID(queue_item_id)) {
      return apiError('INVALID_QUEUE_ITEM', 'A valid queue item ID is required.', 400);
    }

    if (!guest_session_id || !validateSessionId(guest_session_id)) {
      return apiError('INVALID_SESSION', 'A valid guest session ID is required.', 400);
    }

    const supabase = createAdminClient();

    // 1. Look up the queue item
    const { data: item } = await supabase
      .from('queue_items')
      .select('instance_id, guest_session_id, status')
      .eq('id', queue_item_id)
      .maybeSingle();

    if (!item) {
      return apiError('ITEM_NOT_FOUND', 'This reservation was not found.', 404);
    }

    // 2. Ensure this session owns this item — CRITICAL security check
    if (item.guest_session_id !== guest_session_id) {
      return apiError('UNAUTHORIZED', 'You can only cancel your own songs.', 403);
    }

    // 3. Try RPC cancel first
    const { data: result, error: rpcError } = await supabase.rpc('cancel_queue_item_atomic', {
      p_instance_id: item.instance_id,
      p_queue_item_id: queue_item_id,
      p_guest_session_id: guest_session_id,
    });

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (rpcError || !resultRow?.success) {
      // Direct DB update fallback
      await supabase
        .from('queue_items')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', queue_item_id)
        .eq('guest_session_id', guest_session_id);
    }

    // 4. Broadcast Realtime event
    const { data: instance } = await supabase
      .from('instances')
      .select('room_code')
      .eq('id', item.instance_id)
      .maybeSingle();

    if (instance) {
      await supabase.channel(`okekaraoke:instance:${instance.room_code}`).send({
        type: 'broadcast',
        event: 'queue_removed',
        payload: {
          type: 'queue_removed',
          instance_id: item.instance_id,
          room_code: instance.room_code,
          queue_item_id,
          timestamp: new Date().toISOString(),
        },
      });
    }

    return apiSuccess({ cancelled: true });
  } catch (error) {
    console.error('Unexpected error in /api/queue/cancel:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
  }
}
