function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill in your Stripe credentials.`
    )
  }
  return value
}

export const stripeSecretKey = () => requireEnv("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY)

export const stripeWebhookSecret = () =>
  requireEnv("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET)

export const stripePriceId = () => requireEnv("STRIPE_PRICE_ID", process.env.STRIPE_PRICE_ID)
