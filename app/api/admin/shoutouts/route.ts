// ============================================================
// OKEKARAOKE — GET /api/admin/shoutouts
// Fetches recent shoutouts across all TV rooms for Admin Monitoring
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: shoutouts, error } = await supabase
      .from('room_shoutouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

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
