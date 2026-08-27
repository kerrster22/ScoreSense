function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill in your Supabase project credentials.`
    )
  }
  return value
}

export const supabaseUrl = () =>
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)

export const supabasePublishableKey = () =>
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

/** Server-only — bypasses Row Level Security. See lib/supabase/service.ts. */
export const supabaseSecretKey = () =>
  requireEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY)
