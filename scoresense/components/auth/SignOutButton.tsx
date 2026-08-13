"use client"

import { useTransition } from "react"
import { Loader2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/lib/supabase/actions"

export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost" | "default"
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant={variant}
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  )
}
