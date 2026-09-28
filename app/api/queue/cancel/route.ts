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

    // Look up the queue item to get the instance_id
    const { data: item } = await supabase
      .from('queue_items')
      .select('instance_id, guest_session_id, status')
      .eq('id', queue_item_id)
      .single();

    if (!item) {
      return apiError('ITEM_NOT_FOUND', 'This reservation was not found.', 404);
    }

    // Ensure this session owns this item — CRITICAL security check
    if (item.guest_session_id !== guest_session_id) {
      return apiError('UNAUTHORIZED', 'You are not authorized to cancel this reservation.', 403);
    }

    // Call atomic cancel function
    const { data: result, error: rpcError } = await supabase.rpc('cancel_queue_item_atomic', {
      p_instance_id: item.instance_id,
      p_queue_item_id: queue_item_id,
      p_guest_session_id: guest_session_id,
    });

    if (rpcError) {
      console.error('cancel_queue_item_atomic RPC error:', rpcError);
      return apiError('CANCEL_FAILED', 'Failed to cancel reservation. Please try again.', 500);
    }

    const resultRow = Array.isArray(result) ? result[0] : result;

    if (!resultRow?.success) {
      return apiError(
        resultRow?.error_code ?? 'CANCEL_FAILED',
        resultRow?.error_message ?? 'Failed to cancel reservation.',
        400
      );
    }

    // Get room code for realtime broadcast
    const { data: instance } = await supabase
      .from('instances')
      .select('room_code')
      .eq('id', item.instance_id)
      .single();

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
