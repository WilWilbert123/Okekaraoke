import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/queue/transfer
// Transfer guest's queued songs from one room to another (e.g. Solo TV -> TV Screen)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from_room_code, to_room_code, guest_session_id } = body;

    if (!from_room_code || !to_room_code || !guest_session_id) {
      return NextResponse.json(
        { success: false, error: { message: 'from_room_code, to_room_code, and guest_session_id are required' } },
        { status: 400 }
      );
    }

    const fromCode = from_room_code.trim().toUpperCase();
    const toCode = to_room_code.trim().toUpperCase();

    if (fromCode === toCode) {
      return NextResponse.json({ success: true, data: { transferred_count: 0, message: 'Same room code' } });
    }

    const supabase = createAdminClient();

    // 1. Fetch source instance
    const { data: fromInstance, error: fromErr } = await supabase
      .from('instances')
      .select('id')
      .eq('room_code', fromCode)
      .single();

    if (fromErr || !fromInstance) {
      return NextResponse.json(
        { success: false, error: { message: `Source room ${fromCode} not found` } },
        { status: 404 }
      );
    }

    // 2. Fetch destination instance
    const { data: toInstance, error: toErr } = await supabase
      .from('instances')
      .select('id')
      .eq('room_code', toCode)
      .single();

    if (toErr || !toInstance) {
      return NextResponse.json(
        { success: false, error: { message: `Target TV room ${toCode} not found` } },
        { status: 404 }
      );
    }

    // 3. Move queued items belonging to guest_session_id from source to destination
    const { data: updatedItems, error: updateErr } = await supabase
      .from('queue_items')
      .update({ instance_id: toInstance.id })
      .eq('instance_id', fromInstance.id)
      .eq('guest_session_id', guest_session_id)
      .eq('status', 'queued')
      .select('id');

    if (updateErr) {
      console.error('[API/queue/transfer] Error transferring queue:', updateErr);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to transfer songs to target room' } },
        { status: 500 }
      );
    }

    const count = updatedItems?.length ?? 0;

    // 4. Broadcast realtime queue update to both rooms
    try {
      await Promise.all([
        supabase.channel(`okekaraoke:${fromCode}`).send({
          type: 'broadcast',
          event: 'queue_updated',
          payload: { room_code: fromCode },
        }),
        supabase.channel(`okekaraoke:${toCode}`).send({
          type: 'broadcast',
          event: 'queue_updated',
          payload: { room_code: toCode },
        }),
      ]);
    } catch (bcErr) {
      console.error('[API/queue/transfer] Broadcast failed:', bcErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        transferred_count: count,
        from_room_code: fromCode,
        to_room_code: toCode,
      },
    });
  } catch (err: any) {
    console.error('[API/queue/transfer] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: { message: err?.message || 'Server error' } },
      { status: 500 }
    );
  }
}
