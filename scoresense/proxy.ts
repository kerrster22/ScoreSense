import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { safeRedirectPath } from "@/lib/supabase/redirect"

/**
 * Route prefixes that require a signed-in user. Extend this list as more
 * ScoreSense data (songs, practice sessions, settings, ...) moves server-side —
 * everything else stays public, matching the current local-first app.
 */
const PROTECTED_PREFIXES = ["/account"]

/** Auth pages a logged-in user shouldn't need to see again. */
const AUTH_PAGES = ["/login", "/signup"]

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

// Next.js 16 renamed the root request-interception file convention from
// `middleware.ts` to `proxy.ts` (same mechanism, new name/export).
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  if (!user && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", safeRedirectPath(`${pathname}${search}`))
    return NextResponse.redirect(loginUrl)
  }

  if (user && matchesPrefix(pathname, AUTH_PAGES)) {
    const redirectParam = request.nextUrl.searchParams.get("redirect")
    return NextResponse.redirect(new URL(safeRedirectPath(redirectParam), request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next internals, so the
     * session cookie stays fresh across the whole app without re-running on
     * every image/font request.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon|screenshots/).*)",
  ],
}
