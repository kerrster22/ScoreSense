import Link from "next/link"
import type { Metadata } from "next"
import { Music } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./LoginForm"
import { safeRedirectPath } from "@/lib/supabase/redirect"
import { AUTH_ERROR_MESSAGES, AUTH_INFO_MESSAGES, resolveAuthMessage } from "@/lib/supabase/authMessages"

export const metadata: Metadata = {
  title: "Log in - ScoreSense",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; message?: string }>
}) {
  const params = await searchParams
  const redirectTo = safeRedirectPath(params.redirect)
  const errorMessage = resolveAuthMessage(AUTH_ERROR_MESSAGES, params.error)
  const infoMessage = resolveAuthMessage(AUTH_INFO_MESSAGES, params.message)
  const signupHref =
    redirectTo === "/app" ? "/signup" : `/signup?redirect=${encodeURIComponent(redirectTo)}`

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">ScoreSense</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Log in</CardTitle>
            <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {infoMessage ? (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
                {infoMessage}
              </p>
            ) : null}
            {errorMessage ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <LoginForm redirectTo={redirectTo} />
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href={signupHref} className="text-foreground underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
