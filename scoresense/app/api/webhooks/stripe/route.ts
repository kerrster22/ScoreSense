import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripeClient } from "@/lib/stripe/client"
import { stripeWebhookSecret } from "@/lib/stripe/env"
import { createServiceRoleClient } from "@/lib/supabase/service"

export const runtime = "nodejs"

async function upsertFromSubscription(
  service: ReturnType<typeof createServiceRoleClient>,
  customerId: string,
  subscription: Stripe.Subscription,
  userId: string
) {
  const item = subscription.items.data[0]
  const { error } = await service.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item?.price.id ?? null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: "user_id" }
  )
  if (error) throw new Error(`Failed to upsert subscription: ${error.message}`)
}

/** Subscription events (unlike Checkout Sessions) carry no Supabase user id — look it up by customer. */
async function updateByCustomerId(
  service: ReturnType<typeof createServiceRoleClient>,
  customerId: string,
  subscription: Stripe.Subscription
) {
  const item = subscription.items.data[0]
  const { error } = await service
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: item?.price.id ?? null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("stripe_customer_id", customerId)
  if (error) throw new Error(`Failed to update subscription: ${error.message}`)
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  // Signature verification needs the exact raw bytes — never call .json() first.
  const rawBody = await request.text()

  const stripe = getStripeClient()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret())
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 400 }
    )
  }

  try {
    const service = createServiceRoleClient()

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const userId = session.client_reference_id
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
        if (!userId || !customerId || typeof session.subscription !== "string") break
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await upsertFromSubscription(service, customerId, subscription, userId)
        break
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
        await updateByCustomerId(service, customerId, subscription)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
        const { error } = await service
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_customer_id", customerId)
        if (error) throw new Error(`Failed to mark subscription canceled: ${error.message}`)
        break
      }
      default:
        // Acknowledge and no-op — Stripe expects a 2xx for event types we don't handle.
        break
    }
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
