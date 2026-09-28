// ============================================================
// OKEKARAOKE — Supabase Admin Client (Server-side ONLY)
// Uses SERVICE_ROLE key — NEVER expose to browser
// ============================================================
import { createClient } from '@supabase/supabase-js';

// This file must ONLY be imported in server components, route handlers,
// or server actions. Never import in client components.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  // We use 'any' for the Database generic here intentionally.
  // Our API routes handle all validation/typing at the application layer.
  // This avoids needing to keep supabase-gen-types in sync during development.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient = createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
