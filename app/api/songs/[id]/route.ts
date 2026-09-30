import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/songs/[id] — Update song
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) return apiError('INVALID_BODY', 'Body required.', 400);

    const { code, title, artist, youtube_video_id, category, language, is_active } = body;
    const supabase = createAdminClient();

    const { data: song, error } = await supabase
      .from('songs')
      .update({
        ...(code && { code: code.toString().trim() }),
        ...(title && { title: title.trim() }),
        ...(artist && { artist: artist.trim() }),
        youtube_video_id: youtube_video_id ?? null,
        category: category ?? null,
        language: language ?? null,
        ...(typeof is_active === 'boolean' && { is_active }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update song error:', error);
      return apiError('UPDATE_FAILED', error.message, 500);
    }

    return apiSuccess({ song });
  } catch (err) {
    console.error('PUT /api/songs/[id] error:', err);
    return apiError('INTERNAL_ERROR', 'Failed to update song.', 500);
  }
}

// DELETE /api/songs/[id] — Delete song
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();

    // 1. Delete or clear foreign key references in queue_items & reservation_logs
    await supabase.from('queue_items').delete().eq('song_id', id);
    await supabase.from('reservation_logs').delete().eq('queue_item_id', id);

    // 2. Delete song from songs catalog
    const { error } = await supabase.from('songs').delete().eq('id', id);

    if (error) {
      console.warn('Hard delete failed, attempting soft delete:', error.message);
      const { error: softError } = await supabase
        .from('songs')
        .update({ is_active: false })
        .eq('id', id);

      if (softError) {
        return apiError('DELETE_FAILED', softError.message, 500);
      }
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/songs/[id] error:', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete song.', 500);
  }
}
