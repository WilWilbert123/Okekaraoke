// ============================================================
// OKEKARAOKE — GET /api/admin/analytics
// Real-time master analytics and user location tracking
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // 1. Count Active Rooms
    const { count: activeRooms } = await supabase
      .from('instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 2. Count Online Devices & Fetch connected devices for location analytics
    const { data: onlineDevices, count: totalOnlineDevices } = await supabase
      .from('devices')
      .select('id, device_type, device_name, is_online, last_seen_at, created_at')
      .eq('is_online', true);

    // 3. Count Total Songs
    const { count: totalSongs } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true });

    // 4. Count Songs Played Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: reservationsToday } = await supabase
      .from('reservation_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString());

    // 5. Fetch Active Rooms List with details
    const { data: activeRoomsList } = await supabase
      .from('instances')
      .select('id, room_code, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get current client IP & Country from request headers (Cloudflare / Vercel / Standard headers)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     '127.0.0.1';

    const clientCountry = request.headers.get('cf-ipcountry') ||
                          request.headers.get('x-vercel-ip-country') ||
                          'Local Network';

    const clientCity = request.headers.get('x-vercel-ip-city') ||
                       'Unknown City';

    return apiSuccess({
      metrics: {
        active_rooms: activeRooms ?? 0,
        online_devices: totalOnlineDevices ?? 0,
        total_songs: totalSongs ?? 0,
        reservations_today: reservationsToday ?? 0,
      },
      current_location: {
        ip: clientIp,
        country: clientCountry,
        city: clientCity,
      },
      active_rooms_list: activeRoomsList ?? [],
      online_devices_list: onlineDevices ?? [],
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch analytics.', 500);
  }
}
