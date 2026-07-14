"use client"

/**
 * Local export/import of all ScoreSense progress data — a stand-in for real
 * cross-device cloud sync. Bundles every localStorage key this app owns
 * (per-piece practice data, path→hash lookups, session history, achievement
 * progress) into one downloadable JSON file, and can restore it back.
 *
 * Uploaded file bytes (IndexedDB, see uploadStore.ts) are intentionally not
 * included — this is progress data, not a piece library backup.
 */

const OWNED_PREFIXES = ["scoresense_piece_", "ss_"]
const EXPORT_VERSION = 1

interface ExportPayload {
  version: number
  exportedAt: string
  data: Record<string, string>
}

function isOwnedKey(key: string): boolean {
  return OWNED_PREFIXES.some((p) => key.startsWith(p))
}

export function buildExportPayload(): ExportPayload {
  const data: Record<string, string> = {}
  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && isOwnedKey(key)) {
        const value = localStorage.getItem(key)
        if (value != null) data[key] = value
      }
    }
  }
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data }
}

export function downloadProgressExport(): void {
  const payload = buildExportPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `scoresense-progress-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  ok: boolean
  importedCount: number
  error?: string
}

export function importProgressData(json: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, importedCount: 0, error: "That file isn't valid JSON." }
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("data" in parsed) ||
    typeof (parsed as ExportPayload).data !== "object"
  ) {
    return { ok: false, importedCount: 0, error: "That file doesn't look like a ScoreSense progress export." }
  }

  const { data } = parsed as ExportPayload
  let importedCount = 0
  for (const [key, value] of Object.entries(data)) {
    if (!isOwnedKey(key) || typeof value !== "string") continue
    try {
      localStorage.setItem(key, value)
      importedCount++
    } catch {
      // quota exceeded or blocked — skip this key, keep going
    }
  }

  return { ok: true, importedCount }
}
