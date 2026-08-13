/**
 * Fixed copy for `?error=` / `?message=` query-param codes on the auth pages.
 *
 * Codes are looked up against this map rather than rendering the query string
 * directly, so a crafted URL like `/login?message=<anything>` can't be used to
 * inject arbitrary text into the page.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "That link is invalid or has expired. Please request a new one.",
  session_expired: "Your session has expired. Please log in again.",
}

export const AUTH_INFO_MESSAGES: Record<string, string> = {
  check_email: "Check your email to confirm your account before logging in.",
  password_reset: "Your password has been updated. Please log in.",
  reset_email_sent: "If an account exists for that email, a password reset link is on its way.",
}

export function resolveAuthMessage(
  map: Record<string, string>,
  code: string | undefined
): string | null {
  if (!code) return null
  return map[code] ?? null
}
