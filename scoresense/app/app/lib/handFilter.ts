import type { Note, HandVisualMode, HandAudioMode } from "../components/types"

/**
 * Filter notes by visual hand mode.
 * Used consistently by BOTH the visualiser falling-notes render
 * AND the activeKeys computation so highlighting always matches.
 */
export function filterNotesByVisualHand(notes: Note[], mode: HandVisualMode): Note[] {
  switch (mode) {
    case "right-only":
      return notes.filter((n) => n.hand === "right")
    case "left-only":
      return notes.filter((n) => n.hand === "left")
    default:
      return notes
  }
}

/**
 * Filter notes by audio hand mode (for the audio engine).
 */
export function filterNotesByAudioHand(notes: Note[], mode: HandAudioMode): Note[] {
  switch (mode) {
    case "right-only":
      return notes.filter((n) => n.hand === "right")
    case "left-only":
      return notes.filter((n) => n.hand === "left")
    case "mute-right":
      return notes.filter((n) => n.hand !== "right")
    case "mute-left":
      return notes.filter((n) => n.hand !== "left")
    default:
      return notes
  }
}

/**
 * Compute active keys from filtered notes at a given playback time.
 */
export function computeActiveKeys(notes: Note[], playbackTime: number): string[] {
  return notes
    .filter((note) => playbackTime >= note.startTime && playbackTime < note.startTime + note.duration)
    .map((note) => note.note)
}
