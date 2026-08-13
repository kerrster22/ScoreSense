import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { supabasePublishableKey, supabaseUrl } from "./env"

/**
 * Refreshes the Supabase session cookie on every request that passes through
 * middleware, and returns the current user (or null). This is the only place
 * that talks to Supabase Auth via request/response cookies instead of
 * next/headers — the pattern @supabase/ssr requires for middleware.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // IMPORTANT: do not add logic between createServerClient and this call — it
  // revalidates the session token against Supabase Auth (unlike getSession(),
  // which only reads the local cookie and can't be trusted for authorization).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
