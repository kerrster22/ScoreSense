import type { Note, PedalEvent } from "../pianoAudioEngine"

// Pure computation of when each note should attack/release, kept separate
// from Tone.Part wiring so it's directly unit-testable without an
// AudioContext. One entry per note instance (never grouped/merged by time
// or pitch) — that's what lets rapid repeated notes of the same pitch stay
// independently schedulable instead of collapsing into one event.

export type ScheduledEvent = { time: number; note: Note }

const TIME_SNAP_SEC = 0.001

/** Snap to a 1 ms grid purely to absorb float jitter from upstream parsing. */
export function snapTime(t: number): number {
  return Math.round(t / TIME_SNAP_SEC) * TIME_SNAP_SEC
}

/**
 * When the sustain pedal is held down through a note's nominal release time,
 * its audible release is deferred until the next pedal-up event.
 */
export function computeReleaseTime(
  note: Note,
  pedalEvents: PedalEvent[],
  isPedalDownAt: (t: number) => boolean
): number {
  const nominalReleaseTime = note.startTime + note.duration
  if (!isPedalDownAt(nominalReleaseTime)) return nominalReleaseTime
  for (const pe of pedalEvents) {
    if (pe.time > nominalReleaseTime && !pe.down) return pe.time
  }
  return nominalReleaseTime
}

export function computeNoteScheduling(
  notes: Note[],
  pedalEvents: PedalEvent[],
  basePlaybackRate: number,
  isPedalDownAt: (t: number) => boolean
): { attackEvents: ScheduledEvent[]; releaseEvents: ScheduledEvent[] } {
  const attackEvents: ScheduledEvent[] = notes.map((note) => ({
    time: snapTime(note.startTime / basePlaybackRate),
    note,
  }))

  const releaseEvents: ScheduledEvent[] = notes.map((note) => ({
    time: snapTime(computeReleaseTime(note, pedalEvents, isPedalDownAt) / basePlaybackRate),
    note,
  }))

  return { attackEvents, releaseEvents }
}
