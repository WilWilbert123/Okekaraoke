// ============================================================
// OKEKARAOKE — /api/admin/shoutouts
// GET: Fetches recent shoutouts across all TV rooms for Admin Monitoring
// DELETE: Deletes a specific shoutout by ID or clears all shoutouts
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: shoutouts, error } = await supabase
      .from('room_shoutouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Error querying room_shoutouts table:', error.message);
      return apiSuccess([]);
    }

    return apiSuccess(shoutouts || []);
  } catch (error) {
    console.error('Error fetching admin shoutouts:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch shoutouts.', 500);
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
        .from('room_shoutouts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) {
        console.error('Error clearing all shoutouts:', error);
        return apiError('DB_ERROR', 'Failed to clear shoutouts', 500);
      }

      return apiSuccess({ message: 'All shoutouts cleared successfully' });
    }

    if (!id) {
      return apiError('BAD_REQUEST', 'Shoutout ID or all=true required.', 400);
    }

    const { error } = await supabase
      .from('room_shoutouts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting shoutout:', error);
      return apiError('DB_ERROR', 'Failed to delete shoutout', 500);
    }

    return apiSuccess({ message: 'Shoutout deleted successfully', id });
  } catch (error) {
    console.error('Error deleting shoutout:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete shoutout.', 500);
  }
}
