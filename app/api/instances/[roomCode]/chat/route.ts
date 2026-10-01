// ============================================================
// OKEKARAOKE — API Route: /api/instances/[roomCode]/chat
// GET: Fetch recent chat messages for a room
// POST: Persist a new chat message to database
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, validateRoomCode } from '@/lib/utils/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ roomCode: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { roomCode } = await context.params;
    const normalizedCode = validateRoomCode(roomCode);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('room_chats')
      .select('id, sender_name, sender_session_id, text, created_at')
      .eq('room_code', normalizedCode)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.warn('room_chats fetch error (table may not exist yet):', error.message);
      return NextResponse.json({ success: true, messages: [] });
    }

    const messages = (data || []).map((row) => ({
      id: row.id,
      sender_name: row.sender_name,
      sender_session_id: row.sender_session_id,
      text: row.text,
      sent_at: new Date(row.created_at).getTime(),
    }));

    const response = NextResponse.json({ success: true, messages });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
  } catch (err) {
    console.error('Unexpected error in GET /api/instances/[roomCode]/chat:', err);
    return NextResponse.json({ success: true, messages: [] });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { roomCode } = await context.params;
    const normalizedCode = validateRoomCode(roomCode);
    if (!normalizedCode) {
      return apiError('INVALID_ROOM_CODE', 'Invalid room code format.', 400);
    }

    const body = await request.json();
    const { id, sender_name, sender_session_id, text } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return apiError('MISSING_FIELDS', 'Message text is required.', 400);
    }

    const supabase = createAdminClient();
    const insertData: Record<string, any> = {
      room_code: normalizedCode,
      sender_name: sender_name?.trim() || 'Guest',
      sender_session_id: sender_session_id || 'unknown',
      text: text.trim(),
    };
    if (id && typeof id === 'string' && id.trim()) {
      insertData.id = id.trim();
    }

    const { data, error } = await supabase
      .from('room_chats')
      .insert(insertData)
      .select('id, sender_name, sender_session_id, text, created_at')
      .single();

    if (error) {
      console.warn('room_chats insert error (table may not exist yet):', error.message);
      const fallbackMsg = {
        id: `${sender_session_id || 'guest'}-${Date.now()}`,
        sender_name: sender_name?.trim() || 'Guest',
        sender_session_id: sender_session_id || 'unknown',
        text: text.trim(),
        sent_at: Date.now(),
      };
      return NextResponse.json({ success: true, message: fallbackMsg });
    }

    const message = {
      id: data.id,
      sender_name: data.sender_name,
      sender_session_id: data.sender_session_id,
      text: data.text,
      sent_at: new Date(data.created_at).getTime(),
    };

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in POST /api/instances/[roomCode]/chat:', err);
    return apiError('INTERNAL_ERROR', 'Failed to save chat message.', 500);
  }
}
