import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getUserAccessStatus } from "@/lib/stripe/getAccessStatus"
import { CheckoutForm } from "./CheckoutForm"

export const metadata: Metadata = {
  title: "Upgrade - ScoreSense",
}

const FEATURES = [
  "The full piece library, not just the 3 demo pieces",
  "Upload up to 25 pieces of your own",
  "Progress tracking, insights, and practice history",
  "Chord training, warm-ups, and adaptive coaching",
]

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already redirects unauthenticated requests away from /app/*;
  // this check is defense-in-depth so the page is never reachable without a
  // verified session even if middleware config changes.
  if (!user) {
    redirect("/login?redirect=/app/upgrade")
  }

  const { hasAccess } = await getUserAccessStatus(user.id)
  if (hasAccess) {
    redirect("/app")
  }

  const params = await searchParams
  const wasCancelled = params.checkout === "cancelled"

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Upgrade to ScoreSense</CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold text-foreground">£7.99</span> / month, cancel anytime
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {wasCancelled ? (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
                Checkout cancelled — no charge was made.
              </p>
            ) : null}
            <ul className="grid gap-2">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <CheckoutForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
