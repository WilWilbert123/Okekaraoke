// ============================================================
// OKEKARAOKE — /api/admin/devices
// DELETE: Delete a specific device record or clear all offline devices
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearOffline = searchParams.get('clear_offline') === 'true';

    if (clearOffline) {
      const cutoff = new Date(Date.now() - 45000).toISOString();
      const { error, count } = await supabase
        .from('devices')
        .delete()
        .or(`is_online.eq.false,last_seen_at.lt.${cutoff}`);

      if (error) {
        console.error('Error clearing offline devices:', error);
        return apiError('DB_ERROR', 'Failed to clear offline devices', 500);
      }

      return apiSuccess({ message: 'Offline devices cleared successfully from Supabase', count });
    }

    if (!id) {
      return apiError('BAD_REQUEST', 'Device ID or clear_offline=true required.', 400);
    }

    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting device:', error);
      return apiError('DB_ERROR', 'Failed to delete device entry', 500);
    }

    return apiSuccess({ message: 'Device record deleted successfully', id });
  } catch (error) {
    console.error('Error deleting device:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete device.', 500);
  }
}
