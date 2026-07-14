import { describe, it, expect } from "vitest"
import { buildHandAssigner } from "./handDetection"
import type { NoteEvent, TrackInfo } from "./midi"

function note(over: Partial<NoteEvent>): NoteEvent {
  return {
    id: `n${Math.random()}`,
    midi: 60,
    name: "C4",
    time: 0,
    duration: 0.5,
    velocity: 0.8,
    track: 0,
    channel: 0,
    ...over,
  }
}

function track(over: Partial<TrackInfo>): TrackInfo {
  return { index: 0, name: "", channel: 0, noteCount: 1, ...over }
}

describe("buildHandAssigner", () => {
  it("uses track-name keywords when present, with high confidence", () => {
    const tracks = [track({ index: 0, name: "Right Hand", noteCount: 2 }), track({ index: 1, name: "Left Hand", noteCount: 2 })]
    const events = [
      note({ track: 0, midi: 40 }), // low pitch, but the track is explicitly named "Right Hand"
      note({ track: 1, midi: 90 }), // high pitch, but explicitly "Left Hand"
    ]
    const { assign, confidence } = buildHandAssigner(tracks, events)
    expect(confidence).toBe("high")
    expect(assign(events[0])).toBe("right")
    expect(assign(events[1])).toBe("left")
  })

  it("splits two unnamed tracks by median pitch even when their ranges overlap (La Campanella-shaped data)", () => {
    // Mirrors the real measured stats: track 0 (RH) avg ~85 but dips to 44;
    // track 1 (LH) avg ~62 but rises to 98. A fixed pitch threshold can't
    // separate these — median-pitch-per-track can.
    const tracks = [track({ index: 0, name: "Piano", noteCount: 3 }), track({ index: 1, name: "Piano", noteCount: 3 })]
    const events = [
      note({ track: 0, midi: 44 }),
      note({ track: 0, midi: 90 }),
      note({ track: 0, midi: 102 }),
      note({ track: 1, midi: 27 }),
      note({ track: 1, midi: 62 }),
      note({ track: 1, midi: 98 }),
    ]
    const { assign, confidence } = buildHandAssigner(tracks, events)
    expect(confidence).toBe("high")
    // Track 0's median (90) > track 1's median (62) -> track 0 is "right"
    expect(assign(events[0])).toBe("right") // midi 44, low pitch, but it's on the RH track
    expect(assign(events[3])).toBe("left") // midi 27
    expect(assign(events[5])).toBe("left") // midi 98, high pitch, but it's on the LH track
  })

  it("falls back to per-channel median pitch for a single track with multiple channels, with high confidence", () => {
    const tracks = [track({ index: 0, name: "Piano", noteCount: 4 })]
    const events = [
      note({ track: 0, channel: 0, midi: 80 }),
      note({ track: 0, channel: 0, midi: 85 }),
      note({ track: 0, channel: 1, midi: 40 }),
      note({ track: 0, channel: 1, midi: 45 }),
    ]
    const { assign, confidence } = buildHandAssigner(tracks, events)
    expect(confidence).toBe("high")
    expect(assign(events[0])).toBe("right")
    expect(assign(events[2])).toBe("left")
  })

  it("falls back to pitch-gap voice separation for a single track/channel, with low confidence", () => {
    const tracks = [track({ index: 0, name: "Piano", noteCount: 4 })]
    // A wide chord: two notes clustered low, two clustered high, played together.
    const events = [
      note({ track: 0, channel: 0, midi: 40, time: 1.0 }),
      note({ track: 0, channel: 0, midi: 43, time: 1.0 }),
      note({ track: 0, channel: 0, midi: 76, time: 1.0 }),
      note({ track: 0, channel: 0, midi: 79, time: 1.0 }),
    ]
    const { assign, confidence } = buildHandAssigner(tracks, events)
    expect(confidence).toBe("low")
    expect(assign(events[0])).toBe("left")
    expect(assign(events[1])).toBe("left")
    expect(assign(events[2])).toBe("right")
    expect(assign(events[3])).toBe("right")
  })
})
