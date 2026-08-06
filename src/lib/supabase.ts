import { createClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

// Client-side Supabase client. Uses the publishable/anon key only — RLS enforces
// access; the service_role key must never reach the browser (same rule as GEMINI_API_KEY).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(url && anonKey);

if (!hasSupabaseEnv) {
  // Surface a clear message rather than a cryptic network error in dev.
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — DB features are disabled.',
  );
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
