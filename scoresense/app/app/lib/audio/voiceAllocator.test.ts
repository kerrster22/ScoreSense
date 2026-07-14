import { describe, it, expect } from "vitest"
import { VoiceAllocator } from "./voiceAllocator"

describe("VoiceAllocator", () => {
  it("gives two consecutive same-pitch notes with a tiny gap independent voices", () => {
    const a = new VoiceAllocator(8)
    const v1 = a.attack("n1", "C4")
    // n1 hasn't been released yet when n2 attacks (tiny gap / slight overlap)
    const v2 = a.attack("n2", "C4")
    expect(v2).not.toBe(v1)
    expect(a.activeCount).toBe(2)
  })

  it("gives two fully overlapping same-pitch notes independent voices, and releases only the targeted one", () => {
    const a = new VoiceAllocator(8)
    const v1 = a.attack("n1", "C4")
    const v2 = a.attack("n2", "C4")
    expect(v1).not.toBe(v2)

    const released = a.release("n1")
    expect(released).toEqual({ voice: v1, pitch: "C4" })
    expect(a.voiceFor("n1")).toBeNull()
    // n2's voice must be completely unaffected by releasing n1
    expect(a.voiceFor("n2")).toBe(v2)
  })

  it("assigns distinct voices for several rapid repeated notes of the same pitch", () => {
    const a = new VoiceAllocator(8)
    const ids = ["n1", "n2", "n3", "n4", "n5"]
    const voices = ids.map((id) => a.attack(id, "A4"))
    // fewer overlapping notes than pool size -> every one gets its own voice
    expect(new Set(voices).size).toBe(ids.length)
  })

  it("assigns distinct voices to a chord's repeated pitches across separate tracks/hands", () => {
    const a = new VoiceAllocator(8)
    // e.g. both hands strike the same octave-equivalent pitch class at once
    const v1 = a.attack("track0-n1", "C4")
    const v2 = a.attack("track1-n1", "C4")
    expect(v1).not.toBe(v2)
  })

  it("note cleanup removes only the correct note instance", () => {
    const a = new VoiceAllocator(8)
    a.attack("n1", "D4")
    a.attack("n2", "D4")
    a.attack("n3", "E4")
    expect(a.activeCount).toBe(3)

    a.release("n2")
    expect(a.activeCount).toBe(2)
    expect(a.voiceFor("n1")).not.toBeNull()
    expect(a.voiceFor("n3")).not.toBeNull()
    expect(a.voiceFor("n2")).toBeNull()
  })

  it("releasing an unknown or already-released note id is a safe no-op", () => {
    const a = new VoiceAllocator(4)
    expect(a.release("never-attacked")).toBeNull()
    a.attack("n1", "C4")
    a.release("n1")
    expect(a.release("n1")).toBeNull()
  })

  it("frees a voice for reuse once its note is released", () => {
    const a = new VoiceAllocator(2)
    const v1 = a.attack("n1", "C4")
    a.attack("n2", "C4") // uses up the pool's second voice for this pitch
    a.release("n1")
    const v3 = a.attack("n3", "C4")
    // the freed voice should be reusable again
    expect(v3).toBe(v1)
  })

  it("gracefully falls back to voice stealing when overlaps exceed pool size, without throwing", () => {
    const a = new VoiceAllocator(2)
    a.attack("n1", "C4")
    a.attack("n2", "C4")
    // a third simultaneous instance of the same pitch exceeds the pool size
    expect(() => a.attack("n3", "C4")).not.toThrow()
    expect(a.activeCount).toBe(3)
  })

  it("releaseAll forgets every assignment", () => {
    const a = new VoiceAllocator(4)
    a.attack("n1", "C4")
    a.attack("n2", "D4")
    a.releaseAll()
    expect(a.activeCount).toBe(0)
    expect(a.voiceFor("n1")).toBeNull()
    // and voices are free to be reassigned from scratch
    const v = a.attack("n3", "C4")
    expect(v).toBeGreaterThanOrEqual(0)
  })

  it("rejects a non-positive pool size", () => {
    expect(() => new VoiceAllocator(0)).toThrow()
  })
})
