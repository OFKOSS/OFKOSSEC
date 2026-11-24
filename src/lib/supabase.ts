import { createClient } from "@supabase/supabase-js";

/**
 * The anon key is public by design — every table it can reach is protected by
 * Row Level Security. The service-role key must never be shipped to a browser.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// No fallback on purpose: a missing value must fail loudly here rather than
// silently point the site at a stale project.
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "(Vercel → Project → Settings → Environment Variables, or a local .env.local).",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
