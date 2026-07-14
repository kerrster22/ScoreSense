import { CHORD_QUALITIES, INVERSION_LABELS, NOTE_NAMES, type ChordQuality } from "./chordLibrary"

export interface DetectedChord {
  symbol: string
  rootPc: number
  rootName: string
  quality: ChordQuality
  /** 0 = root position, 1 = first inversion, etc. */
  inversion: number
  inversionLabel: string
  /** The actual input MIDI notes that formed this match. */
  notes: number[]
}

/**
 * Names the chord formed by a set of simultaneously-sounding MIDI note numbers,
 * by testing each distinct pitch class as a candidate root against known
 * interval patterns (shared with chordLibrary.ts so detection and the Chord
 * Encyclopedia can't drift apart), then reports the inversion by checking
 * which chord tone is actually in the bass. Returns null when fewer than 3
 * distinct pitch classes are present or no shape matches exactly (e.g.
 * passing tones, single intervals).
 */
export function detectChord(midiNotes: number[]): DetectedChord | null {
  if (midiNotes.length === 0) return null
  const pitchClasses = Array.from(new Set(midiNotes.map((m) => ((m % 12) + 12) % 12)))
  if (pitchClasses.length < 3) return null

  for (const root of pitchClasses) {
    const relative = new Set(pitchClasses.map((pc) => (pc - root + 12) % 12))
    for (const quality of CHORD_QUALITIES) {
      if (quality.intervals.length !== relative.size) continue
      if (!quality.intervals.every((iv) => relative.has(iv))) continue

      const bassPc = ((Math.min(...midiNotes) % 12) + 12) % 12
      const bassInterval = (bassPc - root + 12) % 12
      const inversion = quality.intervals.indexOf(bassInterval)
      const resolvedInversion = inversion === -1 ? 0 : inversion

      return {
        symbol: `${NOTE_NAMES[root]}${quality.symbolSuffix}`,
        rootPc: root,
        rootName: NOTE_NAMES[root],
        quality,
        inversion: resolvedInversion,
        inversionLabel: INVERSION_LABELS[resolvedInversion] ?? "Root position",
        notes: midiNotes,
      }
    }
  }
  return null
}
