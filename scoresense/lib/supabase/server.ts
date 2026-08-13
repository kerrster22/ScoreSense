import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"
import { supabasePublishableKey, supabaseUrl } from "./env"

/**
 * Server-side Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the session via Next's cookie store, never touches localStorage.
 *
 * Cookie writes only succeed from Server Actions and Route Handlers; calling `.set()` from
 * a plain Server Component throws, which is why it's wrapped in try/catch below — the
 * middleware is responsible for keeping cookies fresh during normal page renders.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component render — the middleware refreshes the
          // session on the next request, so this is safe to ignore.
        }
      },
    },
  })
}
