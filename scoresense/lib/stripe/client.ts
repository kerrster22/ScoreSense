import Stripe from "stripe"
import { stripeSecretKey } from "./env"

/**
 * Server-only Stripe client. Never import this from a client component —
 * it's constructed from the secret key and has full account access.
 */
let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey(), {
      apiVersion: "2026-07-29.dahlia",
    })
  }
  return stripeClient
}
