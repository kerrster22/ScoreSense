import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserAccessStatus } from "@/lib/stripe/getAccessStatus"
import { PIECE_FILE_EXTENSIONS } from "@/lib/parsePieceFilename"
import { MAX_UPLOADS_PER_USER, MAX_UPLOAD_SIZE_BYTES, UPLOAD_BUCKET } from "@/lib/uploads/constants"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("piece_uploads")
    .select("id, filename, size_bytes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: "unknown" }, { status: 500 })

  return NextResponse.json({
    uploads: (data ?? []).map((row) => ({
      id: row.id,
      name: row.filename,
      size: row.size_bytes,
      addedAt: row.created_at,
    })),
  })
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/)
  return (match?.[0] ?? "").toLowerCase()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Real, server-side paywall enforcement for uploads — independent of whatever
  // the /app page already redirected on.
  const { hasAccess } = await getUserAccessStatus(user.id)
  if (!hasAccess) return NextResponse.json({ error: "subscription_required" }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 })
  }

  const extension = getExtension(file.name)
  if (!PIECE_FILE_EXTENSIONS.includes(extension as (typeof PIECE_FILE_EXTENSIONS)[number])) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 })
  }

  // Pre-check before touching Storage, so a user already at the cap isn't
  // charged the upload bandwidth just to have the DB insert rejected.
  const { count } = await supabase
    .from("piece_uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  if ((count ?? 0) >= MAX_UPLOADS_PER_USER) {
    return NextResponse.json({ error: "upload_limit_reached" }, { status: 409 })
  }

  const id = randomUUID()
  const storagePath = `${user.id}/${id}${extension}`

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || undefined, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: "unknown" }, { status: 500 })
  }

  const { data: row, error: insertError } = await supabase
    .from("piece_uploads")
    .insert({
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      extension,
      size_bytes: file.size,
    })
    .select("id, filename, size_bytes, created_at")
    .single()

  if (insertError || !row) {
    // Race: the DB trigger rejected this insert (cap hit between our pre-check
    // and now) or some other failure — clean up the orphaned Storage object.
    await supabase.storage.from(UPLOAD_BUCKET).remove([storagePath])
    if (insertError?.code === "P0001") {
      return NextResponse.json({ error: "upload_limit_reached" }, { status: 409 })
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 })
  }

  return NextResponse.json({
    id: row.id,
    name: row.filename,
    size: row.size_bytes,
    addedAt: row.created_at,
  })
}
