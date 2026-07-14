export interface DifficultyNoteInput {
  midi: number
  startTime: number
}

/**
 * Heuristic 1-5 difficulty rating from note density, simultaneity (chord
 * thickness / hand independence proxy), pitch spread, and tempo. This is a
 * fast proxy for "how hard does this look", not a music-theory-aware
 * analysis — good enough to rank pieces in a library list.
 */
export function computeDifficulty(notes: DifficultyNoteInput[], bpm: number, durationSec: number): number {
  if (notes.length === 0 || durationSec <= 0) return 1

  const notesPerSec = notes.length / durationSec

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime)
  const WINDOW_SEC = 0.05
  let simultaneitySum = 0
  for (let i = 0; i < sorted.length; i++) {
    let count = 1
    for (let j = i - 1; j >= 0 && sorted[i].startTime - sorted[j].startTime < WINDOW_SEC; j--) count++
    for (let j = i + 1; j < sorted.length && sorted[j].startTime - sorted[i].startTime < WINDOW_SEC; j++) count++
    simultaneitySum += count
  }
  const avgSimultaneity = simultaneitySum / sorted.length

  const midis = notes.map((n) => n.midi)
  const pitchRange = Math.max(...midis) - Math.min(...midis)

  const densityScore = clamp01(notesPerSec / 12)
  const simultaneityScore = clamp01((avgSimultaneity - 1) / 4)
  const tempoScore = clamp01((bpm - 60) / 140)
  const rangeScore = clamp01((pitchRange - 24) / 48)

  const composite = densityScore * 0.4 + simultaneityScore * 0.3 + tempoScore * 0.15 + rangeScore * 0.15
  return Math.min(5, Math.max(1, Math.round(1 + composite * 4)))
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
