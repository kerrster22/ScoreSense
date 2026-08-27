/**
 * Statuses that grant paid access. `past_due` is included deliberately: Stripe's
 * Smart Retries already give a grace period before a subscription auto-cancels,
 * so cutting access on the very first failed charge would be unnecessarily harsh.
 */
const PAID_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"])

export function hasActiveAccess(status: string | null | undefined): boolean {
  if (!status) return false
  return PAID_ACCESS_STATUSES.has(status)
}
