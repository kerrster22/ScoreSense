"use server"

import * as Sentry from "@sentry/nextjs"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service"
import { getStripeClient } from "@/lib/stripe/client"
import { stripePriceId } from "@/lib/stripe/env"
import { siteOrigin } from "@/lib/siteOrigin"

export interface CheckoutActionState {
  error: string | null
}

/**
 * Reuses the caller's Stripe customer if one was already recorded, otherwise
 * creates it and upserts a placeholder `subscriptions` row (status
 * "incomplete") via the service-role client. Doing this before the Checkout
 * Session exists guarantees the customer<->user mapping is already in place
 * by the time the webhook needs to look it up.
 */
async function getOrCreateStripeCustomerId(userId: string, email: string | null): Promise<string> {
  const service = createServiceRoleClient()

  const { data: existing } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing?.stripe_customer_id) return existing.stripe_customer_id

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  })

  const { error } = await service
    .from("subscriptions")
    .upsert({ user_id: userId, stripe_customer_id: customer.id, status: "incomplete" }, { onConflict: "user_id" })

  if (error) {
    throw new Error(`Failed to record Stripe customer: ${error.message}`)
  }

  return customer.id
}

export async function createCheckoutSession(
  _prevState: CheckoutActionState,
  _formData: FormData
): Promise<CheckoutActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You need to be signed in to subscribe." }
  }

  let customerId: string
  try {
    customerId = await getOrCreateStripeCustomerId(user.id, user.email ?? null)
  } catch (err) {
    Sentry.captureException(err)
    console.error("createCheckoutSession: failed to get/create Stripe customer", err)
    return { error: "We couldn't start checkout. Please try again." }
  }

  const origin = await siteOrigin()
  const stripe = getStripeClient()

  let checkoutUrl: string | null
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: stripePriceId(), quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${origin}/app?checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/upgrade?checkout=cancelled`,
      allow_promotion_codes: true,
    })
    checkoutUrl = session.url
  } catch (err) {
    Sentry.captureException(err)
    console.error("createCheckoutSession: failed to create Checkout Session", err)
    return { error: "We couldn't start checkout. Please try again." }
  }

  if (!checkoutUrl) {
    return { error: "We couldn't start checkout. Please try again." }
  }

  redirect(checkoutUrl)
}

/** No form state (mirrors signOutAction's shape) — a portal redirect has no useful inline error to show. */
export async function createBillingPortalSession(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirect=/account")

  const service = createServiceRoleClient()
  const { data } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!data?.stripe_customer_id) redirect("/app/upgrade")

  const origin = await siteOrigin()
  const stripe = getStripeClient()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/account`,
  })

  redirect(portalSession.url)
}
