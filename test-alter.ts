import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { query: "ALTER TABLE room_chats ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;" });
  console.log('Result execute_sql:', data, error);
}
run();
