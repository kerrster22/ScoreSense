"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { safeRedirectPath } from "@/lib/supabase/redirect"
import { siteOrigin } from "@/lib/siteOrigin"
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth"

export interface AuthActionState {
  error: string | null
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Please confirm your email address before logging in. Check your inbox for the confirmation link.",
      }
    }
    // Supabase returns the same "Invalid login credentials" message whether the
    // email is unknown or the password is wrong — surfaced as-is to avoid
    // revealing which case applies.
    return { error: "Invalid email or password." }
  }

  const redirectTo = safeRedirectPath(formData.get("redirect")?.toString())
  redirect(redirectTo)
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const origin = await siteOrigin()

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      // Same generic message as the "new account" success path — creating an
      // account with an email that already exists must not be distinguishable
      // from a fresh signup.
      redirect("/login?message=check_email")
    }
    return { error: "We couldn't create your account. Please try again." }
  }

  redirect("/login?message=check_email")
}

export async function forgotPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const origin = await siteOrigin()

  // Always attempt the call, but never let its result (or a thrown error) reveal
  // whether the email is registered — the UI shows the same confirmation either way.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/auth/confirm` : undefined,
  })

  redirect("/forgot-password?message=reset_email_sent")
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()

  // Requires an active recovery session, established by /auth/confirm from the
  // emailed reset link. Without one, updateUser fails rather than silently
  // succeeding for the wrong account.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Your password reset link has expired. Please request a new one." }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return { error: "We couldn't update your password. Please try again." }
  }

  await supabase.auth.signOut()
  redirect("/login?message=password_reset")
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
