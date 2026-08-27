"use client"

import { useTransition } from "react"
import { Loader2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBillingPortalSession } from "@/lib/stripe/actions"

export function ManageBillingButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => createBillingPortalSession())}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <CreditCard />}
      Manage billing
    </Button>
  )
}
