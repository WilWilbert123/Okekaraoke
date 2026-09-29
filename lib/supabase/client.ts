// ============================================================
// OKEKARAOKE — Supabase Client (Browser / Client-side)
// Uses ANON key — safe for browser use
// ============================================================
import { createBrowserClient } from '@supabase/ssr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserClient: ReturnType<typeof createBrowserClient<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browserClient = createBrowserClient<any>(url, anonKey);

  return browserClient;
}
