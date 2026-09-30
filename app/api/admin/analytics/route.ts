// ============================================================
// OKEKARAOKE — GET /api/admin/analytics
// Real-time master analytics, user location tracking,
// & accurate realtime device & user counts per room
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';
import { extractLocationFromRequest } from '@/lib/utils/location';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // 1. Mark stale devices (last seen > 45s ago) as offline
    const cutoff = new Date(Date.now() - 45000).toISOString();
    await supabase
      .from('devices')
      .update({ is_online: false })
      .lt('last_seen_at', cutoff)
      .eq('is_online', true);

    // 2. Count Active Rooms
    const { count: activeRooms } = await supabase
      .from('instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // 3. Count Online Devices & Fetch connected devices
    const { data: onlineDevices } = await supabase
      .from('devices')
      .select('id, instance_id, device_type, device_name, is_online, last_seen_at, city, country, ip_address, created_at, instances(room_code)')
      .order('last_seen_at', { ascending: false });

    // 4. Count Total Songs
    const { count: totalSongs } = await supabase
      .from('songs')
      .select('id', { count: 'exact', head: true });

    // 5. Count Songs Played Today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: reservationsToday } = await supabase
      .from('reservation_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString());

    // 6. Fetch Active Rooms List with details
    const { data: activeRoomsList } = await supabase
      .from('instances')
      .select('id, room_code, status, city, country, ip_address, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30);

    // Build room user counts & device breakdowns
    const deviceList = (onlineDevices || []).map((d: any) => ({
      id: d.id,
      instance_id: d.instance_id,
      room_code: d.instances?.room_code || 'N/A',
      device_type: d.device_type,
      device_name: d.device_name || `${d.device_type} device`,
      is_online: d.is_online && new Date(d.last_seen_at).getTime() > Date.now() - 45000,
      city: d.city || 'Local Area',
      country: d.country || 'Philippines',
      ip_address: d.ip_address || '',
      last_seen_at: d.last_seen_at,
    }));

    const roomCounts = new Map<string, { user_count: number; tv_count: number; remote_count: number; city: string; country: string }>();

    deviceList.forEach((d) => {
      if (d.is_online) {
        const roomCode = d.room_code;
        const current = roomCounts.get(roomCode) || { user_count: 0, tv_count: 0, remote_count: 0, city: d.city, country: d.country };
        current.user_count += 1;
        if (d.device_type === 'tv') current.tv_count += 1;
        if (d.device_type === 'remote') current.remote_count += 1;
        if (d.city && d.city !== 'Local Area') current.city = d.city;
        if (d.country && d.country !== 'Philippines') current.country = d.country;
        roomCounts.set(roomCode, current);
      }
    });

    const activeRoomsFormatted = (activeRoomsList || []).map((room) => {
      const stats = roomCounts.get(room.room_code) || { user_count: 0, tv_count: 0, remote_count: 0, city: room.city || 'Local Area', country: room.country || 'Philippines' };
      return {
        id: room.id,
        room_code: room.room_code,
        status: room.status,
        created_at: room.created_at,
        user_count: stats.user_count,
        tv_count: stats.tv_count,
        remote_count: stats.remote_count,
        city: stats.city,
        country: stats.country,
        is_online: stats.user_count > 0,
      };
    });

    const loc = extractLocationFromRequest(request);

    return apiSuccess({
      metrics: {
        active_rooms: activeRooms ?? 0,
        online_devices: deviceList.filter((d) => d.is_online).length,
        total_songs: totalSongs ?? 0,
        reservations_today: reservationsToday ?? 0,
      },
      current_location: loc,
      active_rooms_list: activeRoomsFormatted,
      online_devices_list: deviceList,
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch analytics.', 500);
  }
}
