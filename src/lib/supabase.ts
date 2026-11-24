import { createClient } from "@supabase/supabase-js";

/**
 * The anon key is public by design — every table it can reach is protected by
 * Row Level Security. The service-role key must never be shipped to a browser.
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://csrvdnejogvkxnkdtnid.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzcnZkbmVqb2d2a3hua2R0bmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MjI2NjQsImV4cCI6MjEwOTA5ODY2NH0.LaJnkgDPMNcaGBGMrJBerlo0e7g6BEiqi2mtQFILXfs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
