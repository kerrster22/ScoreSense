import { describe, it, expect } from "vitest"
import { ScoringEngine } from "./scoringEngine"
import type { UnifiedNoteEvent } from "./hybrid/types"

function ref(id: string, midi: number, startTime: number): UnifiedNoteEvent {
  return {
    id,
    midi,
    noteName: `midi${midi}`,
    startTime,
    duration: 0.3,
    hand: "right",
    source: { confidence: 1 },
  }
}

describe("ScoringEngine repeated-pitch matching", () => {
  it("matches two rapid repeated same-pitch notes to two different reference notes, not the same one twice", () => {
    const notes = [ref("r1", 60, 1.0), ref("r2", 60, 1.06)]
    const engine = new ScoringEngine(notes)

    const first = engine.noteOn({ midi: 60, time: 1.0 })
    const second = engine.noteOn({ midi: 60, time: 1.06 })

    expect(first?.refNoteId).toBe("r1")
    expect(second?.refNoteId).toBe("r2")
    expect(first?.refNoteId).not.toBe(second?.refNoteId)
  })

  it("matches out-of-order presses to the nearest still-unmatched reference note", () => {
    const notes = [ref("r1", 60, 1.0), ref("r2", 60, 1.06)]
    const engine = new ScoringEngine(notes)

    // user happens to play the *second* repeat's timing first
    const first = engine.noteOn({ midi: 60, time: 1.06 })
    const second = engine.noteOn({ midi: 60, time: 1.0 })

    expect(first?.refNoteId).toBe("r2")
    expect(second?.refNoteId).toBe("r1")
  })

  it("a wrong-pitch or truly duplicate press doesn't consume an already-matched reference note", () => {
    const notes = [ref("r1", 60, 1.0)]
    const engine = new ScoringEngine(notes)

    const first = engine.noteOn({ midi: 60, time: 1.0 })
    expect(first?.refNoteId).toBe("r1")

    // pressing the same key again shouldn't match anything — it's already used
    const second = engine.noteOn({ midi: 60, time: 1.02 })
    expect(second).toBeNull()
  })

  it("tick() resolves an unplayed reference note to a miss without affecting a same-pitch sibling still in-window", () => {
    const notes = [ref("r1", 60, 1.0), ref("r2", 60, 5.0)]
    const engine = new ScoringEngine(notes, { missMs: 400 })

    const misses = engine.tick(1.5) // 500ms past r1's start -> past the 400ms miss window
    expect(misses).toHaveLength(1)
    expect(misses[0].refNoteId).toBe("r1")

    // r2 must still be matchable — tick() must not have swept it up too
    const played = engine.noteOn({ midi: 60, time: 5.0 })
    expect(played?.refNoteId).toBe("r2")
  })

  it("a chord with a repeated pitch across two hands scores both instances independently", () => {
    const notes = [
      { ...ref("r1", 60, 2.0), hand: "left" as const },
      { ...ref("r2", 60, 2.0), hand: "right" as const },
    ]
    const engine = new ScoringEngine(notes)

    const a = engine.noteOn({ midi: 60, time: 2.0 })
    const b = engine.noteOn({ midi: 60, time: 2.0 })
    expect(new Set([a?.refNoteId, b?.refNoteId]).size).toBe(2)
  })
})
