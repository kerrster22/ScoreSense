import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SignOutButton } from "@/components/auth/SignOutButton"
import { ProfileForm } from "./ProfileForm"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Account - ScoreSense",
}

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already redirects unauthenticated requests away from /account;
  // this check is defense-in-depth so the page is never reachable without a
  // verified session even if middleware config changes.
  if (!user) {
    redirect("/login?redirect=/account")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="text-sm text-muted-foreground">Manage your ScoreSense profile.</p>
        </div>
        <SignOutButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar host is provider-controlled, unknown at build time
              <img
                src={profile.avatar_url}
                alt=""
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-lg font-semibold text-accent">
                {(profile?.display_name ?? user.email ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{profile?.display_name ?? "Your profile"}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-6" />
          <ProfileForm initialDisplayName={profile?.display_name ?? ""} />
        </CardContent>
      </Card>
    </main>
  )
}
