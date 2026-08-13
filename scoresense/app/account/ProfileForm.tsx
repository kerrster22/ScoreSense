"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfile, type ProfileActionState } from "./actions"

const initialState: ProfileActionState = { error: null, success: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      Save changes
    </Button>
  )
}

export function ProfileForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction] = useActionState(updateProfile, initialState)

  useEffect(() => {
    if (state.success) toast.success("Profile updated")
  }, [state.success])

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={initialDisplayName}
          maxLength={80}
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <SubmitButton />
      </div>
    </form>
  )
}
