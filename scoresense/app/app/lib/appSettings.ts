"use client"

/** App-wide settings, distinct from per-piece persistence — currently just the beta-feature flags. */

const STORAGE_KEY = "ss_app_settings"

export interface AppSettings {
  /** Clickable/QWERTY/microphone play-along input, live scoring feedback, and the end-of-piece
   * session summary — off by default since it's still a beta feature. */
  playAlongEnabled: boolean
  /** Live "chord currently playing" labels (falling-notes canvas + transport bar) — off by
   * default since they flicker on/off as chords are momentarily detected then lost. */
  liveChordDisplayEnabled: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  playAlongEnabled: false,
  liveChordDisplayEnabled: false,
}

export function loadAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    console.warn("Failed to save app settings to localStorage")
  }
}
