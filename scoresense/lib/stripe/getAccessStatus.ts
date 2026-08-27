import { createClient } from "@/lib/supabase/server"
import { hasActiveAccess } from "./access"

export interface UserAccessStatus {
  status: string | null
  hasAccess: boolean
  stripeCustomerId: string | null
}

/**
 * Single source of truth for "does this user currently have paid access."
 * Consumed by app/app/page.tsx, app/app/upgrade/page.tsx, app/account/page.tsx,
 * and every /api/uploads/* route — status logic lives in exactly one place.
 */
export async function getUserAccessStatus(userId: string): Promise<UserAccessStatus> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!data) {
    return { status: null, hasAccess: false, stripeCustomerId: null }
  }

  return {
    status: data.status,
    hasAccess: hasActiveAccess(data.status),
    stripeCustomerId: data.stripe_customer_id,
  }
}
