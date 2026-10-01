// ============================================================
// OKEKARAOKE — /api/admin/tables/clear
// POST: Clears target Supabase table data safely from admin backend
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

const ALLOWED_TABLES = [
  'reservation_logs',
  'room_shoutouts',
  'room_chats',
  'feedbacks',
  'queue_items',
];

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const { table } = body;

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return apiError('BAD_REQUEST', `Invalid table name. Allowed: ${ALLOWED_TABLES.join(', ')}`, 400);
    }

    const { error, count } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error(`Error purging table ${table}:`, error.message);
      return apiError('DB_ERROR', `Failed to clear table ${table}: ${error.message}`, 500);
    }

    return apiSuccess({
      message: `Table '${table}' cleared successfully.`,
      table,
      count: count ?? 0,
    });
  } catch (error) {
    console.error('Error clearing table:', error);
    return apiError('INTERNAL_ERROR', 'Failed to clear table data.', 500);
  }
}
