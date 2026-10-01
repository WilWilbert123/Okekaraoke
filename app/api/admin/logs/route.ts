// ============================================================
// OKEKARAOKE — /api/admin/logs
// GET: Fetches reservation logs for admin monitoring
// DELETE: Clears reservation logs
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: logs, error } = await supabase
      .from('reservation_logs')
      .select('*, instances(room_code)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Error fetching reservation_logs:', error.message);
      return apiSuccess([]);
    }

    const formatted = (logs || []).map((item: any) => ({
      id: item.id,
      instance_id: item.instance_id,
      room_code: item.instances?.room_code || 'N/A',
      queue_item_id: item.queue_item_id,
      guest_session_id: item.guest_session_id,
      action: item.action,
      metadata: item.metadata,
      created_at: item.created_at,
    }));

    return apiSuccess(formatted);
  } catch (error) {
    console.error('Error fetching reservation logs:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch reservation logs.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('all') === 'true';

    if (clearAll) {
      const { error } = await supabase
        .from('reservation_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('Error clearing reservation_logs:', error);
        return apiError('DB_ERROR', 'Failed to clear reservation logs.', 500);
      }

      return apiSuccess({ message: 'Reservation logs cleared successfully.' });
    }

    if (!id) {
      return apiError('BAD_REQUEST', 'Log ID or all=true required.', 400);
    }

    const { error } = await supabase
      .from('reservation_logs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting log item:', error);
      return apiError('DB_ERROR', 'Failed to delete log entry.', 500);
    }

    return apiSuccess({ message: 'Log entry deleted successfully', id });
  } catch (error) {
    console.error('Error deleting reservation log:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete reservation log.', 500);
  }
}
