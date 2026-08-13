"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { displayNameSchema } from "@/lib/validation/auth"

export interface ProfileActionState {
  error: string | null
  success: boolean
}

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = displayNameSchema.safeParse(formData.get("displayName"))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name.", success: false }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Your session has expired. Please log in again.", success: false }
  }

  // RLS (auth.uid() = id) enforces that this can only ever touch the caller's
  // own row — the .eq("id", user.id) below is belt-and-suspenders, not the
  // actual authorization boundary.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data })
    .eq("id", user.id)

  if (error) {
    return { error: "We couldn't update your profile. Please try again.", success: false }
  }

  revalidatePath("/account")
  return { error: null, success: true }
}
