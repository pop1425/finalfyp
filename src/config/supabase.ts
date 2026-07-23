// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = !!(
  SUPABASE_URL &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_URL.trim() !== "" &&
  SUPABASE_URL.startsWith("https://")
);

const validUrl = isSupabaseConfigured ? SUPABASE_URL : "https://placeholder-to-prevent-crash.supabase.co";
const validKey = isSupabaseConfigured ? SUPABASE_ANON_KEY : "placeholder-key";

let supabaseClient: ReturnType<typeof createClient> | null = null;

try {
  supabaseClient = createClient(validUrl, validKey);
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}

export const supabase = supabaseClient!;
