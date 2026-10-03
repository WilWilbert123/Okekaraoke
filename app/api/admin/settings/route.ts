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
    const shoutout_enabled = settings?.shoutout_enabled ?? true;
    const banner_type = settings?.banner_type ?? 'ticker';
    const banner_text = settings?.banner_text ?? 'Welcome to OKEKARAOKE! Scan the QR code to reserve your favorite songs.';
    const banner_image_url = settings?.banner_image_url ?? '';
    let banner_images: string[] = Array.isArray(settings?.banner_images)
      ? settings.banner_images
      : [];

    // Fallback: if banner_images is empty but banner_image_url exists
    if (banner_images.length === 0 && banner_image_url) {
      banner_images = [banner_image_url];
    }

    const banner_speed = settings?.banner_speed ?? 20;
    const theme = settings?.theme ?? 'classic';

    return apiSuccess({
      banner_enabled,
      shoutout_enabled,
      banner_type,
      banner_text,
      banner_image_url,
      banner_images,
      banner_speed,
      theme,
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch settings.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { banner_enabled, shoutout_enabled, banner_type, banner_text, banner_image_url, banner_images, banner_speed, theme } = body;

    const supabase = createAdminClient();

    // Standardize images array
    const imageList: string[] = Array.isArray(banner_images)
      ? banner_images.filter((url: any) => typeof url === 'string' && url.trim().length > 0)
      : (banner_image_url ? [banner_image_url] : []);

    const primaryImageUrl = imageList.length > 0 ? imageList[0] : (String(banner_image_url ?? ''));
    const bType = String(banner_type ?? 'ticker');

    // Attempt upsert with new columns first
    const fullRecord = {
      id: 'global_settings',
      banner_enabled: Boolean(banner_enabled),
      shoutout_enabled: shoutout_enabled !== undefined ? Boolean(shoutout_enabled) : true,
      banner_type: bType,
      banner_text: String(banner_text ?? ''),
      banner_image_url: primaryImageUrl,
      banner_images: imageList,
      banner_speed: Number(banner_speed ?? 20),
      theme: String(theme ?? 'classic'),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('app_settings')
      .upsert(fullRecord, { onConflict: 'id' });

    if (upsertError) {
      console.warn('Settings upsert with new columns returned warning/error, attempting legacy column fallback:', upsertError.message);
      // Fallback upsert without new columns
      try {
        await supabase
          .from('app_settings')
          .upsert({
            id: 'global_settings',
            banner_enabled: Boolean(banner_enabled),
            banner_text: String(banner_text ?? ''),
            banner_image_url: primaryImageUrl,
            banner_speed: Number(banner_speed ?? 20),
            theme: String(theme ?? 'classic'),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch {}
    }

    // Broadcast live banner update to all active TV screens in real-time!
    const bannerPayload = {
      banner_enabled: Boolean(banner_enabled),
      shoutout_enabled: shoutout_enabled !== undefined ? Boolean(shoutout_enabled) : true,
      banner_type: bType,
      banner_text: String(banner_text ?? ''),
      banner_image_url: primaryImageUrl,
      banner_images: imageList,
      banner_speed: Number(banner_speed ?? 20),
      theme: String(theme ?? 'classic'),
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
