// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase project keys from your Supabase Dashboard
export const SUPABASE_URL: string = "YOUR_SUPABASE_URL";
export const SUPABASE_ANON_KEY: string = "YOUR_SUPABASE_ANON_KEY";

export const isSupabaseConfigured = !!(
  SUPABASE_URL && 
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_URL.trim() !== ""
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
