"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type AuthStatus = "loading" | "authed" | "guest"

/**
 * Small auth-aware nav fragment: shows Log in/Sign up when signed out, or
 * Account when signed in. Reads the session client-side via onAuthStateChange
 * so it stays in sync after login/logout without a full page reload; this is
 * purely a UI convenience — actual route protection is enforced by middleware.
 */
export function AuthNavLinks() {
  const [status, setStatus] = useState<AuthStatus>("loading")

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setStatus(user ? "authed" : "guest")
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session?.user ? "authed" : "guest")
    })

    return () => subscription.unsubscribe()
  }, [])

  if (status === "loading") {
    return <div className="h-9 w-20" aria-hidden />
  }

  if (status === "authed") {
    return (
      <Link href="/account">
        <Button variant="outline" size="sm">
          Account
        </Button>
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          Log in
        </Button>
      </Link>
      <Link href="/signup">
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          Sign up
        </Button>
      </Link>
    </div>
  )
}
