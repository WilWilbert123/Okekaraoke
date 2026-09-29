// ============================================================
// OKEKARAOKE — Realtime Server Broadcast Helper
// Reliably broadcasts realtime events from Next.js server routes
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

export async function broadcastRealtime(
  roomCode: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!roomCode) return false;

  const normalizedCode = roomCode.toUpperCase().trim();
  const supabase = createAdminClient();
  const channelName = `okekaraoke:instance:${normalizedCode}`;
  const channel = supabase.channel(channelName);

  return new Promise<boolean>((resolve) => {
    let resolved = false;

    const cleanupAndResolve = (success: boolean) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try {
          supabase.removeChannel(channel);
        } catch {
          // Ignore cleanup errors
        }
        resolve(success);
      }
    };

    // Safety timeout: 2 seconds max
    const timer = setTimeout(() => {
      console.warn(`[Realtime Broadcast] Timeout sending '${event}' to ${channelName}`);
      cleanupAndResolve(false);
    }, 2000);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel
          .send({
            type: 'broadcast',
            event,
            payload,
          })
          .then(() => {
            cleanupAndResolve(true);
          })
          .catch((err) => {
            console.error(`[Realtime Broadcast] Send error for '${event}':`, err);
            cleanupAndResolve(false);
          });
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.warn(`[Realtime Broadcast] Channel status '${status}' for ${channelName}`);
        cleanupAndResolve(false);
      }
    });
  });
}
