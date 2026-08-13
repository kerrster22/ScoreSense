import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/supabase/redirect"

/**
 * Confirms email-based auth links: signup confirmation, password recovery,
 * email change, and invites. Supabase's default email templates point at a
 * Supabase-hosted verify endpoint that returns tokens in a URL fragment, which
 * a server can't read — so this app's email templates must instead be
 * customised to link here with `token_hash`/`type` query params (see the
 * external setup checklist). verifyOtp() below exchanges those for a real
 * session, stored via the same cookie-based flow as every other sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeRedirectPath(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      // Recovery links must always land on the reset-password form, regardless
      // of whatever `next` the email template happened to carry.
      const destination = type === "recovery" ? "/reset-password" : next
      return NextResponse.redirect(new URL(destination, origin))
    }
  }

  const loginUrl = new URL("/login", origin)
  loginUrl.searchParams.set("error", "invalid_link")
  return NextResponse.redirect(loginUrl)
}
