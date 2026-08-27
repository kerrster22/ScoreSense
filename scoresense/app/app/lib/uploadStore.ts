"use client"

/**
 * Server-backed storage for user-uploaded piece files (Supabase Storage +
 * the piece_uploads table, via /api/uploads). Replaces the old IndexedDB
 * implementation — uploads now belong to the account (not the browser), so
 * the 25-piece cap can be enforced server-side and pieces sync across devices.
 */

export interface UploadRecord {
  id: string
  name: string
  size: number
  addedAt: string
}

export type UploadErrorCode = "upload_limit_reached" | "subscription_required" | "invalid_file" | "unknown"

const UPLOAD_ERROR_CODES: readonly UploadErrorCode[] = [
  "upload_limit_reached",
  "subscription_required",
  "invalid_file",
  "unknown",
]

export class UploadError extends Error {
  code: UploadErrorCode
  constructor(code: UploadErrorCode) {
    super(code)
    this.code = code
  }
}

function toUploadErrorCode(value: unknown): UploadErrorCode {
  return typeof value === "string" && (UPLOAD_ERROR_CODES as string[]).includes(value)
    ? (value as UploadErrorCode)
    : "unknown"
}

export async function saveUpload(file: File): Promise<UploadRecord> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch("/api/uploads", { method: "POST", body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new UploadError(toUploadErrorCode(body?.error))
  }
  return res.json()
}

export async function listUploads(): Promise<UploadRecord[]> {
  const res = await fetch("/api/uploads")
  if (!res.ok) return []
  const body = await res.json().catch(() => ({ uploads: [] }))
  return body.uploads ?? []
}

/** Returns a short-lived signed URL for playback, or null on failure. */
export async function getUploadUrl(id: string): Promise<string | null> {
  const res = await fetch(`/api/uploads/${encodeURIComponent(id)}/file`)
  if (!res.ok) return null
  const body = await res.json().catch(() => ({}))
  return body.url ?? null
}

export async function deleteUpload(id: string): Promise<void> {
  await fetch(`/api/uploads/${encodeURIComponent(id)}`, { method: "DELETE" })
}
