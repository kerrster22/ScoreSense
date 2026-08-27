import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { loadMidiFromUrl } from "./midi"
import { loadMusicXmlFromUrl } from "@/lib/musicmxl"
import { alignMidiWithMusicXml } from "./hybrid/align"
import { buildHandAssigner } from "./handDetection"

// Regression test for the reported bug: in pieces like La Campanella, notes
// clearly meant for the right hand were shown/scored as left hand. Root
// cause was that hand assignment used the MusicXML score's staff number
// (which can differ from the actually-performed hand due to cross-staff
// engraving) and ignored the MIDI file's own — usually more reliable —
// track split entirely. This test runs the real pipeline exactly as
// useHybridScore.ts wires it, against the actual bundled files, and pins
// the fix: MIDI-track-vs-final-hand disagreement should be at (or very
// near) zero, down from a measured 16.7% before the fix.

const PIECE_DIR = path.resolve(__dirname, "../../../public/pieces")
const BASENAME = "etude-s-1413-in-g-minor-la-campanella-liszt"

function mockFetchFromDisk() {
  const orig = global.fetch
  // @ts-expect-error - test-only stub; loadMidiFromUrl/loadMusicXmlFromUrl only need fetch(url) -> Response
  global.fetch = async (url: string) => {
    const name = decodeURIComponent(String(url).split("/").pop()!)
    const buf = fs.readFileSync(path.join(PIECE_DIR, name))
    return new Response(buf, { status: 200 })
  }
  return () => {
    global.fetch = orig
  }
}

describe("hand assignment regression (La Campanella, real files)", () => {
  it("MIDI track split and final assigned hand agree for effectively all notes", async () => {
    const restore = mockFetchFromDisk()
    try {
      const midiResult = await loadMidiFromUrl(`/pieces/${BASENAME}.mid`)
      const xmlResult = await loadMusicXmlFromUrl(`/pieces/${BASENAME}.mxl`)

      const { assign, confidence } = buildHandAssigner(midiResult.tracks, midiResult.events)
      expect(confidence).toBe("high") // this file has a clean 2-track split

      const midiById = new Map(midiResult.events.map((e) => [e.id, e]))
      const midiEvents = midiResult.events.map((e) => ({
        id: e.id,
        midi: e.midi,
        noteName: e.name,
        startTime: e.time,
        duration: e.duration,
        velocity: e.velocity,
        track: e.track,
      }))
      const xmlEvents = xmlResult.events.map((x) => ({
        id: x.id,
        midi: x.midi,
        noteName: x.note,
        staff: x.staff,
        hand: x.hand,
        voice: x.voice != null ? String(x.voice) : undefined,
        measure: x.measure,
        startTime: x.startTime,
        duration: x.duration,
      }))

      const { events } = alignMidiWithMusicXml(midiEvents, xmlEvents, {
        midiHandHint: (id) => {
          const e = midiById.get(id)
          return e ? assign(e) : undefined
        },
        preferMidiHand: confidence === "high",
      })

      let checked = 0
      let disagreements = 0
      for (const e of events) {
        const midiId = e.source.midiId
        if (!midiId) continue
        const midiEvt = midiById.get(midiId)
        if (!midiEvt) continue
        const trackHand = assign(midiEvt)
        checked++
        if (trackHand !== e.hand) disagreements++
      }

      expect(checked).toBeGreaterThan(4000) // sanity: we actually checked the whole piece
      expect(disagreements).toBe(0)
    } finally {
      restore()
    }
  }, 60000)
})
