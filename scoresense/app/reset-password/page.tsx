import Link from "next/link"
import type { Metadata } from "next"
import { Music } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResetPasswordForm } from "./ResetPasswordForm"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Reset password - ScoreSense",
}

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold tracking-tight">ScoreSense</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Set a new password</CardTitle>
            <CardDescription>
              {user
                ? "Choose a new password for your account."
                : "This link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {user ? (
              <ResetPasswordForm />
            ) : (
              <Button asChild className="w-full">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
