"use client"

/**
 * Global (cross-piece) rollup of *why* notes get missed — feeds the Adaptive
 * Practice Coach's recommendations. Deliberately just tag counts, not a
 * trained model: rule-based personalization over real telemetry, which is
 * the right amount of engineering for a client-only, no-backend app.
 */

const STORAGE_KEY = "ss_coach_profile"

export type WeaknessTag = "left-hand-leap" | "right-hand-leap" | "fast-passage" | "timing-drift"

export type CoachProfile = Record<string, number>

export function loadCoachProfile(): CoachProfile {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CoachProfile) : {}
  } catch {
    return {}
  }
}

function saveCoachProfile(profile: CoachProfile): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    console.warn("Failed to save coach profile to localStorage")
  }
}

export function recordCoachWeaknessTags(tags: string[]): void {
  if (tags.length === 0) return
  const profile = loadCoachProfile()
  for (const tag of tags) profile[tag] = (profile[tag] ?? 0) + 1
  saveCoachProfile(profile)
}
