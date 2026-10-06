import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { category, message, guest_name, room_code, session_id } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return apiError('INVALID_MESSAGE', 'Feedback message cannot be empty.', 400);
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('feedbacks')
      .insert({
        category: category ?? 'feedback',
        message: message.trim(),
        guest_name: guest_name ?? 'Guest',
        room_code: room_code ?? null,
        session_id: session_id ?? null,
        status: 'unread',
      })
      .select()
      .single();

    if (error) {
      console.error('Database feedback insert error:', error);
      return apiError('DB_ERROR', 'Failed to record feedback.', 500);
    }

    return apiSuccess(data, 201);
  } catch (err) {
    console.error('Feedback API error:', err);
    return apiError('SERVER_ERROR', 'An unexpected error occurred.', 500);
  }
}
