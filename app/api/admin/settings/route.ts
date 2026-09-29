// ============================================================
// OKEKARAOKE — GET & POST /api/admin/settings
// Manages system settings, announcement banner, and admin configs
// ============================================================

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/utils/apiHelpers';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch settings from app_settings table (or default fallback)
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .maybeSingle();

    const banner_enabled = settings?.banner_enabled ?? false;
    const banner_text = settings?.banner_text ?? 'Welcome to OKEKARAOKE! Scan the QR code to reserve your favorite songs.';
    const banner_image_url = settings?.banner_image_url ?? '';
    const banner_speed = settings?.banner_speed ?? 20;

    return apiSuccess({
      banner_enabled,
      banner_text,
      banner_image_url,
      banner_speed,
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch settings.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { banner_enabled, banner_text, banner_image_url, banner_speed } = body;

    const supabase = createAdminClient();

    // Upsert into app_settings table
    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert({
        id: 'global_settings',
        banner_enabled: Boolean(banner_enabled),
        banner_text: String(banner_text ?? ''),
        banner_image_url: String(banner_image_url ?? ''),
        banner_speed: Number(banner_speed ?? 20),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Settings upsert error:', upsertError);
    }

    // Broadcast live banner update to all active TV screens!
    const bannerPayload = {
      banner_enabled: Boolean(banner_enabled),
      banner_text: String(banner_text ?? ''),
      banner_image_url: String(banner_image_url ?? ''),
      banner_speed: Number(banner_speed ?? 20),
    };

    await supabase.channel('okekaraoke:global').send({
      type: 'broadcast',
      event: 'banner_updated',
      payload: bannerPayload,
    });

    // Broadcast to active instance channels so TVs receive it instantly
    const { data: activeInstances } = await supabase
      .from('instances')
      .select('room_code')
      .eq('status', 'active');

    if (activeInstances && activeInstances.length > 0) {
      for (const inst of activeInstances) {
        await supabase.channel(`okekaraoke:instance:${inst.room_code.toUpperCase()}`).send({
          type: 'broadcast',
          event: 'banner_updated',
          payload: bannerPayload,
        });
      }
    }

    return apiSuccess(bannerPayload);
  } catch (error) {
    console.error('Error updating admin settings:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update settings.', 500);
  }
}
