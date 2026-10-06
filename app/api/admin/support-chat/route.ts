import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

// GET /api/admin/support-chat?session_id=... OR feedback_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const feedbackId = searchParams.get('feedback_id');

    const supabase = createAdminClient();
    let query = supabase.from('admin_support_chats').select('*');

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (feedbackId) {
      query = query.eq('feedback_id', feedbackId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      // Table might not be populated yet
      return apiSuccess([]);
    }

    return apiSuccess(data ?? []);
  } catch (err) {
    console.error('Support chat fetch error:', err);
    return apiError('SERVER_ERROR', 'Failed to fetch messages.', 500);
  }
}

// POST /api/admin/support-chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_id, feedback_id, sender_type, sender_name, message } = body;

    if (!session_id || !message || typeof message !== 'string' || !message.trim()) {
      return apiError('INVALID_INPUT', 'session_id and message are required.', 400);
    }

    const supabase = createAdminClient();

    let validFeedbackId: string | null = null;
    if (feedback_id) {
      const { data: existingFeedback } = await supabase
        .from('feedbacks')
        .select('id')
        .eq('id', feedback_id)
        .maybeSingle();

      if (existingFeedback) {
        validFeedbackId = existingFeedback.id;
      }
    }

    const { data, error } = await supabase
      .from('admin_support_chats')
      .insert({
        session_id,
        feedback_id: validFeedbackId,
        sender_type: sender_type === 'admin' ? 'admin' : 'user',
        sender_name: sender_name || (sender_type === 'admin' ? 'Admin Support' : 'Guest'),
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Support chat insert DB error:', error);
      return apiError('DB_ERROR', 'Failed to send message.', 500);
    }

    return apiSuccess(data, 201);
  } catch (err) {
    console.error('Support chat POST error:', err);
    return apiError('SERVER_ERROR', 'Failed to process message.', 500);
  }
}
