"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"
import { supabasePublishableKey, supabaseUrl } from "./env"

/**
 * Browser-side Supabase client. Safe to import from client components — it only ever
 * holds the public publishable key, and session cookies are managed by @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey())
}
