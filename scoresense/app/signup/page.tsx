import Link from "next/link"
import type { Metadata } from "next"
import { Music } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SignupForm } from "./SignupForm"
import { safeRedirectPath } from "@/lib/supabase/redirect"

export const metadata: Metadata = {
  title: "Sign up - ScoreSense",
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const params = await searchParams
  const redirectTo = safeRedirectPath(params.redirect)
  const loginHref =
    redirectTo === "/app" ? "/login" : `/login?redirect=${encodeURIComponent(redirectTo)}`

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">ScoreSense</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>Start practicing smarter with ScoreSense.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <SignupForm redirectTo={redirectTo} />
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={loginHref} className="text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
