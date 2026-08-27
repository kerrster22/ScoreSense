"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createCheckoutSession, type CheckoutActionState } from "@/lib/stripe/actions"

const initialState: CheckoutActionState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      Subscribe
    </Button>
  )
}

export function CheckoutForm() {
  const [state, formAction] = useActionState(createCheckoutSession, initialState)

  return (
    <form action={formAction} className="grid gap-3">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  )
}
