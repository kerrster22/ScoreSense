import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service"
import { getStripeClient } from "@/lib/stripe/client"
import { getUserAccessStatus } from "@/lib/stripe/getAccessStatus"
import { PracticeApp } from "./PracticeApp"

/**
 * Closes the race between the user's browser redirecting back from Stripe
 * Checkout and the async webhook landing: without this, a freshly-subscribed
 * user could bounce straight back to /app/upgrade on their very first visit.
 * The webhook remains the source of truth for every later lifecycle event
 * (renewals, cancellations, payment failures) — this is purely a synchronous
 * fast-path for the initial redirect.
 */
async function syncCheckoutSession(checkoutSessionId: string, userId: string): Promise<void> {
  try {
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["subscription"],
    })
    if (session.client_reference_id !== userId || typeof session.subscription !== "object") return
    const subscription = session.subscription
    if (!subscription) return

    const service = createServiceRoleClient()
    await service.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer!.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        price_id: subscription.items.data[0]?.price.id ?? null,
        current_period_end: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: "user_id" }
    )
  } catch {
    // Best-effort fast path only — the webhook will reconcile this shortly
    // regardless, so a failure here just means one extra bounce through
    // /app/upgrade for the user rather than a stuck account.
  }
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_session_id?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already redirects unauthenticated requests away from /app;
  // this check is defense-in-depth so the page is never reachable without a
  // verified session even if middleware config changes.
  if (!user) {
    redirect("/login?redirect=/app")
  }

  const params = await searchParams
  if (params.checkout_session_id) {
    await syncCheckoutSession(params.checkout_session_id, user.id)
  }

  const { hasAccess } = await getUserAccessStatus(user.id)
  if (!hasAccess) {
    redirect("/app/upgrade")
  }

  return <PracticeApp mode="full" />
}
