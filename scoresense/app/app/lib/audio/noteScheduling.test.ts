import { describe, it, expect } from "vitest"
import { computeNoteScheduling, computeReleaseTime, snapTime } from "./noteScheduling"
import type { Note, PedalEvent } from "../pianoAudioEngine"

function note(id: string, pitch: string, startTime: number, duration: number): Note {
  return { id, note: pitch, startTime, duration }
}

describe("snapTime", () => {
  it("rounds to the nearest millisecond", () => {
    expect(snapTime(1.2344)).toBeCloseTo(1.234, 5)
    expect(snapTime(1.2346)).toBeCloseTo(1.235, 5)
  })
})

describe("computeReleaseTime", () => {
  it("uses the nominal release time when the pedal isn't down", () => {
    const n = note("n1", "C4", 1, 0.5)
    const t = computeReleaseTime(n, [], () => false)
    expect(t).toBeCloseTo(1.5, 5)
  })

  it("extends the release to the next pedal-up event when the pedal is held", () => {
    const n = note("n1", "C4", 1, 0.5)
    const pedalEvents: PedalEvent[] = [
      { time: 0.5, down: true, value: 100 },
      { time: 2.2, down: false, value: 0 },
    ]
    const t = computeReleaseTime(n, pedalEvents, (at) => at >= 0.5 && at < 2.2)
    expect(t).toBeCloseTo(2.2, 5)
  })

  it("falls back to the nominal release time if the pedal never comes back up", () => {
    const n = note("n1", "C4", 1, 0.5)
    const pedalEvents: PedalEvent[] = [{ time: 0.5, down: true, value: 100 }]
    const t = computeReleaseTime(n, pedalEvents, () => true)
    expect(t).toBeCloseTo(1.5, 5)
  })
})

describe("computeNoteScheduling", () => {
  it("never merges notes — one attack and one release event per note instance", () => {
    // Rapid repeated same-pitch notes, ~30ms apart, as in a fast trill/repeat passage.
    const notes = [
      note("n1", "C5", 1.0, 0.05),
      note("n2", "C5", 1.03, 0.05),
      note("n3", "C5", 1.06, 0.05),
    ]
    const { attackEvents, releaseEvents } = computeNoteScheduling(notes, [], 1, () => false)
    expect(attackEvents).toHaveLength(3)
    expect(releaseEvents).toHaveLength(3)
    expect(new Set(attackEvents.map((e) => e.note.id)).size).toBe(3)
  })

  it("keeps exactly simultaneous chord notes (including repeated pitches) as separate events", () => {
    const notes = [
      note("n1", "C4", 2.0, 1.0),
      note("n2", "E4", 2.0, 1.0),
      note("n3", "C4", 2.0, 1.0), // e.g. same pitch class doubled an octave apart in a different hand
    ]
    const { attackEvents } = computeNoteScheduling(notes, [], 1, () => false)
    expect(attackEvents).toHaveLength(3)
    expect(attackEvents.every((e) => e.time === attackEvents[0].time)).toBe(true)
  })

  it("scales attack/release times by the playback rate", () => {
    const notes = [note("n1", "C4", 2.0, 1.0)]
    const { attackEvents, releaseEvents } = computeNoteScheduling(notes, [], 0.5, () => false)
    // half tempo -> transport time is piece time / rate = piece time * 2
    expect(attackEvents[0].time).toBeCloseTo(4.0, 5)
    expect(releaseEvents[0].time).toBeCloseTo(6.0, 5)
  })
})
