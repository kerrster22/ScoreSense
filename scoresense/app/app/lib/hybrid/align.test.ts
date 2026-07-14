import { describe, it, expect } from "vitest"
import { alignMidiWithMusicXml } from "./align"
import type { MidiNoteEvent, XmlNoteEvent } from "./types"

function midiNote(id: string, midi: number, startTime: number, duration = 0.2): MidiNoteEvent {
  return { id, midi, noteName: `m${midi}`, startTime, duration }
}

describe("alignMidiWithMusicXml with repeated pitches", () => {
  it("produces one unified event per MIDI event for rapid same-pitch repeats, with unique ids", () => {
    const midiEvents = [
      midiNote("mid-1", 76, 1.0),
      midiNote("mid-2", 76, 1.05),
      midiNote("mid-3", 76, 1.1),
    ]
    const { events, stats } = alignMidiWithMusicXml(midiEvents, [])

    expect(events).toHaveLength(3)
    expect(new Set(events.map((e) => e.id)).size).toBe(3)
    expect(stats.midiCount).toBe(3)
    expect(stats.unmatchedMidi).toBe(3) // no xml events supplied
  })

  it("matches repeated MIDI pitches to distinct XML notes in sequence rather than all matching the first", () => {
    const midiEvents = [
      midiNote("mid-1", 76, 1.0),
      midiNote("mid-2", 76, 1.05),
      midiNote("mid-3", 76, 1.1),
    ]
    // XML notes for the same three repeated pitches, close enough in time to
    // all be plausible matches for any one of the MIDI events.
    const xmlEvents: XmlNoteEvent[] = [
      { id: "xml-1", midi: 76, noteName: "m76", startTime: 1.0, duration: 0.2 },
      { id: "xml-2", midi: 76, noteName: "m76", startTime: 1.05, duration: 0.2 },
      { id: "xml-3", midi: 76, noteName: "m76", startTime: 1.1, duration: 0.2 },
    ]
    const { events } = alignMidiWithMusicXml(midiEvents, xmlEvents)

    expect(events).toHaveLength(3)
    const xmlIdsUsed = events.map((e) => e.source.xmlId)
    expect(new Set(xmlIdsUsed).size).toBe(3) // every xml note consumed exactly once
  })

  it("keeps a chord's repeated pitch across two tracks as two independent unified events", () => {
    const midiEvents = [
      { ...midiNote("t0-n1", 60, 2.0), track: 0 },
      { ...midiNote("t1-n1", 60, 2.0), track: 1 },
    ]
    const { events } = alignMidiWithMusicXml(midiEvents, [])
    expect(events).toHaveLength(2)
    expect(events[0].id).not.toBe(events[1].id)
  })
})

describe("alignMidiWithMusicXml hand reconciliation", () => {
  // Regression coverage for the La Campanella bug: cross-staff engraving
  // means a score's staff number doesn't always match which hand actually
  // plays a note, but the MIDI file's own track split usually does.
  it("prefers the MIDI hand hint over XML staff when preferMidiHand is true (cross-staff engraving)", () => {
    const midiEvents = [midiNote("mid-1", 76, 1.0)]
    const xmlEvents: XmlNoteEvent[] = [
      { id: "xml-1", midi: 76, noteName: "m76", startTime: 1.0, duration: 0.2, hand: "left", staff: 2 },
    ]
    const { events } = alignMidiWithMusicXml(midiEvents, xmlEvents, {
      midiHandHint: (id) => (id === "mid-1" ? "right" : undefined),
      preferMidiHand: true,
    })
    expect(events[0].hand).toBe("right")
    expect(events[0].source.handSource).toBe("midi")
  })

  it("keeps today's XML-staff hand when preferMidiHand is false or absent, even if a hint disagrees", () => {
    const midiEvents = [midiNote("mid-1", 76, 1.0)]
    const xmlEvents: XmlNoteEvent[] = [
      { id: "xml-1", midi: 76, noteName: "m76", startTime: 1.0, duration: 0.2, hand: "left", staff: 2 },
    ]
    const { events } = alignMidiWithMusicXml(midiEvents, xmlEvents, {
      midiHandHint: (id) => (id === "mid-1" ? "right" : undefined),
      // preferMidiHand omitted -> defaults to false
    })
    expect(events[0].hand).toBe("left")
    expect(events[0].source.handSource).toBe("xml")
  })

  it("uses the MIDI hand hint for unmatched notes regardless of preferMidiHand", () => {
    const midiEvents = [midiNote("mid-1", 40, 1.0)] // low pitch -> old threshold would say "left"
    const { events } = alignMidiWithMusicXml(midiEvents, [], {
      midiHandHint: (id) => (id === "mid-1" ? "right" : undefined),
      preferMidiHand: false,
    })
    expect(events[0].hand).toBe("right")
    expect(events[0].source.handSource).toBe("midi")
  })

  it("falls back to the pitch threshold only when no hint is available at all", () => {
    const midiEvents = [midiNote("mid-1", 40, 1.0), midiNote("mid-2", 80, 1.0)]
    const { events } = alignMidiWithMusicXml(midiEvents, [])
    const byId = Object.fromEntries(events.map((e) => [e.source.midiId, e]))
    expect(byId["mid-1"].hand).toBe("left")
    expect(byId["mid-1"].source.handSource).toBe("fallback")
    expect(byId["mid-2"].hand).toBe("right")
  })
})
