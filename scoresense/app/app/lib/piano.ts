import type { PianoKey } from "../components/types"

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export function midiToNoteName(midi: number) {
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

function isBlackKey(noteName: string) {
  return noteName.includes("#")
}

/** Inverse of the note-name formula above: "C#4" -> 61. Returns null if unparseable. */
export function noteNameToMidi(noteName: string): number | null {
  const match = /^([A-G]#?)(-?\d+)$/.exec(noteName)
  if (!match) return null
  const [, name, octaveStr] = match
  const idx = NOTE_NAMES.indexOf(name)
  if (idx === -1) return null
  const octave = parseInt(octaveStr, 10)
  return idx + (octave + 1) * 12
}

/**
 * Full 88-key piano range:
 * A0 (midi 21) -> C8 (midi 108)
 */
export function generateFullPianoKeys(): PianoKey[] {
  const keys: PianoKey[] = []
  for (let midi = 21; midi <= 108; midi++) {
    const note = midiToNoteName(midi)
    keys.push({ note, isBlack: isBlackKey(note) })
  }
  return keys
}
