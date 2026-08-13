import Link from "next/link"
import type { Metadata } from "next"
import { Music } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "./ForgotPasswordForm"
import { AUTH_INFO_MESSAGES, resolveAuthMessage } from "@/lib/supabase/authMessages"

export const metadata: Metadata = {
  title: "Forgot password - ScoreSense",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams
  const infoMessage = resolveAuthMessage(AUTH_INFO_MESSAGES, params.message)

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">ScoreSense</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {infoMessage ? (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
                {infoMessage}
              </p>
            ) : null}
            <ForgotPasswordForm />
            <p className="text-center text-sm text-muted-foreground">
              Remembered your password?{" "}
              <Link href="/login" className="text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
