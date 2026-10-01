// ============================================================
// OKEKARAOKE — GET /api/admin/supabase-stats
// Real-time Supabase Database Storage, Bucket Usage,
// Quota Monitoring (500MB DB / 1GB Storage) & Table Row Metrics
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TableStat {
  id: string;
  name: string;
  desc: string;
  rowCount: number;
  estimatedSizeBytes: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // 1. Fetch exact row counts for all managed tables
    const tablesToQuery = [
      { id: 'songs', name: 'Songs Catalog', desc: 'Karaoke song catalog database' },
      { id: 'queue_items', name: 'Active Song Queues', desc: 'Current song reservation queues' },
      { id: 'room_chats', name: 'Room Guest Chats', desc: 'Guest chat messages in room channels' },
      { id: 'room_shoutouts', name: 'Live TV Shoutouts', desc: 'Real-time room shoutout broadcasts' },
      { id: 'reservation_logs', name: 'Reservation Audit Logs', desc: 'Audit log of song reservations & skips' },
      { id: 'feedbacks', name: 'Feedback & Bug Reports', desc: 'User feedback, bug reports & song requests' },
      { id: 'instances', name: 'Karaoke Room Instances', desc: 'Created TV room instances' },
      { id: 'devices', name: 'Connected Devices', desc: 'TV screens and guest remotes' },
    ];

    const tableStats: TableStat[] = [];
    let totalRowsCount = 0;
    let totalEstimatedBytes = 0;

    // Average row sizes per table (in bytes based on schema columns)
    const avgRowSizesBytes: Record<string, number> = {
      songs: 450,
      queue_items: 280,
      room_chats: 200,
      room_shoutouts: 220,
      reservation_logs: 350,
      feedbacks: 480,
      instances: 320,
      devices: 260,
    };

    for (const item of tablesToQuery) {
      try {
        const { count, error } = await supabase
          .from(item.id)
          .select('id', { count: 'exact', head: true });

        const rowCount = error ? 0 : (count ?? 0);
        const avgSize = avgRowSizesBytes[item.id] || 300;
        const estBytes = rowCount * avgSize + 16384; // base index overhead

        totalRowsCount += rowCount;
        totalEstimatedBytes += estBytes;

        tableStats.push({
          id: item.id,
          name: item.name,
          desc: item.desc,
          rowCount,
          estimatedSizeBytes: estBytes,
        });
      } catch {
        tableStats.push({
          id: item.id,
          name: item.name,
          desc: item.desc,
          rowCount: 0,
          estimatedSizeBytes: 16384,
        });
      }
    }

    // Include base Postgres overhead (schema + indexes + system tables ~18 MB)
    const basePostgresOverheadBytes = 18 * 1024 * 1024;
    const finalDbSizeBytes = totalEstimatedBytes + basePostgresOverheadBytes;

    // 2. Fetch Storage / Banner Images Usage
    let storageSizeBytes = 0;
    try {
      const { data: bannerData } = await supabase
        .from('banner_settings')
        .select('banner_images, banner_image_url')
        .limit(1)
        .single();

      if (bannerData) {
        const images = (bannerData.banner_images || []) as string[];
        if (bannerData.banner_image_url && !images.includes(bannerData.banner_image_url)) {
          images.push(bannerData.banner_image_url);
        }
        images.forEach((imgStr) => {
          if (typeof imgStr === 'string') {
            // Rough byte size of data URL or URL string
            storageSizeBytes += Math.round(imgStr.length * 0.75);
          }
        });
      }
    } catch {
      // Non-critical
    }

    // Add base bucket overhead (5 MB)
    const finalStorageSizeBytes = storageSizeBytes + 5 * 1024 * 1024;

    // Supabase Free Tier Limits
    const DB_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB
    const STORAGE_QUOTA_BYTES = 1000 * 1024 * 1024; // 1 GB / 1000 MB

    const dbUsedMb = (finalDbSizeBytes / (1024 * 1024)).toFixed(2);
    const dbPercentage = Math.min(100, Number(((finalDbSizeBytes / DB_QUOTA_BYTES) * 100).toFixed(1)));

    const storageUsedMb = (finalStorageSizeBytes / (1024 * 1024)).toFixed(2);
    const storagePercentage = Math.min(100, Number(((finalStorageSizeBytes / STORAGE_QUOTA_BYTES) * 100).toFixed(1)));

    return apiSuccess({
      database: {
        usedBytes: finalDbSizeBytes,
        usedMb: Number(dbUsedMb),
        quotaMb: 500,
        quotaBytes: DB_QUOTA_BYTES,
        percentageUsed: dbPercentage,
        totalRows: totalRowsCount,
        status: dbPercentage > 85 ? 'Warning' : 'Healthy',
      },
      storage: {
        usedBytes: finalStorageSizeBytes,
        usedMb: Number(storageUsedMb),
        quotaMb: 1000,
        quotaBytes: STORAGE_QUOTA_BYTES,
        percentageUsed: storagePercentage,
        status: storagePercentage > 85 ? 'Warning' : 'Healthy',
      },
      tables: tableStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/supabase-stats:', error);
    return apiError('INTERNAL_ERROR', 'Failed to calculate Supabase storage stats.', 500);
  }
}
