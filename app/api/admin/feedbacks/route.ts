import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      // Return empty list if table doesn't exist yet
      return apiSuccess([]);
    }

    return apiSuccess(data ?? []);
  } catch (err) {
    console.error('Admin feedbacks fetch error:', err);
    return apiError('SERVER_ERROR', 'Failed to load feedbacks.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return apiError('MISSING_FIELDS', 'ID and status are required.', 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('feedbacks')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError('UPDATE_FAILED', 'Failed to update feedback status.', 500);
    }

    return apiSuccess(data);
  } catch (err) {
    console.error('Admin feedback update error:', err);
    return apiError('SERVER_ERROR', 'Failed to update feedback.', 500);
  }
}
