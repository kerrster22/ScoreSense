import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UPLOAD_BUCKET } from "@/lib/uploads/constants"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // RLS already scopes this to the caller's own rows, so "not found" and "not
  // owned" are indistinguishable here — that's intentional, don't leak existence.
  const { data: row } = await supabase
    .from("piece_uploads")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })

  await supabase.storage.from(UPLOAD_BUCKET).remove([row.storage_path])

  const { error } = await supabase.from("piece_uploads").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: "unknown" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
