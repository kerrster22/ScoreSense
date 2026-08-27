import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UPLOAD_BUCKET } from "@/lib/uploads/constants"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: row } = await supabase
    .from("piece_uploads")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { data: signed, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(row.storage_path, 60)

  if (error || !signed) return NextResponse.json({ error: "unknown" }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}
