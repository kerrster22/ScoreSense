"use client"

/**
 * Global (cross-piece) chord-skill tracking — a player's chord fluency isn't
 * a property of any one piece, so this lives outside PiecePersistence,
 * mirroring the load/save shape of userProgress.ts's `ss_user_progress`.
 */

const STORAGE_KEY = "ss_chord_mastery"

// A chord counts as "mastered" once training has produced enough correct,
// accurate reps — explicit and tunable, not a black-box heuristic.
const MASTERY_MIN_CORRECT_REPS = 5
const MASTERY_MIN_ACCURACY = 0.8

export interface ChordMasteryEntry {
  timesSeenInPieces: number
  trainingAttempts: number
  trainingCorrect: number
  bestReactionMs: number | null
  masteredAt: string | null
}

export type ChordMasteryStore = Record<string, ChordMasteryEntry>

function defaultEntry(): ChordMasteryEntry {
  return { timesSeenInPieces: 0, trainingAttempts: 0, trainingCorrect: 0, bestReactionMs: null, masteredAt: null }
}

export function loadChordMastery(): ChordMasteryStore {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChordMasteryStore) : {}
  } catch {
    return {}
  }
}

function saveChordMastery(store: ChordMasteryStore): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    console.warn("Failed to save chord mastery to localStorage")
  }
}

/** Called when a chord is recognized while playing/analyzing a real piece (not training). */
export function recordChordSeenInPieces(chordIds: string[]): void {
  if (chordIds.length === 0) return
  const store = loadChordMastery()
  for (const id of chordIds) {
    const entry = store[id] ?? defaultEntry()
    entry.timesSeenInPieces++
    store[id] = entry
  }
  saveChordMastery(store)
}

/** Called once per Chord Training prompt with the outcome. Returns the updated entry. */
export function recordChordTrainingResult(
  chordId: string,
  correct: boolean,
  reactionMs: number
): ChordMasteryEntry {
  const store = loadChordMastery()
  const entry = store[chordId] ?? defaultEntry()
  entry.trainingAttempts++
  if (correct) {
    entry.trainingCorrect++
    if (entry.bestReactionMs == null || reactionMs < entry.bestReactionMs) entry.bestReactionMs = reactionMs
  }
  if (
    !entry.masteredAt &&
    entry.trainingCorrect >= MASTERY_MIN_CORRECT_REPS &&
    entry.trainingCorrect / entry.trainingAttempts >= MASTERY_MIN_ACCURACY
  ) {
    entry.masteredAt = new Date().toISOString()
  }
  store[chordId] = entry
  saveChordMastery(store)
  return entry
}

export function getChordMasteryEntry(chordId: string): ChordMasteryEntry | null {
  return loadChordMastery()[chordId] ?? null
}

export function countMastered(chordIds: string[]): number {
  const store = loadChordMastery()
  return chordIds.filter((id) => !!store[id]?.masteredAt).length
}
