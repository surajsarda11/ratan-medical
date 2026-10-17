import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error('Missing server-side Supabase admin credentials. Configure SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in Vercel.');
  }

  // This client is server-only. Never import it into a Client Component or expose the key.
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
