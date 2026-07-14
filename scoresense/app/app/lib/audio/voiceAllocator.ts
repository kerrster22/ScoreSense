// Pure voice-assignment bookkeeping for SamplerVoicePool — deliberately has
// no Tone.js/Web Audio dependency so the actual note-identity/collision
// logic can be unit tested directly (see voiceAllocator.test.ts).
//
// Given a fixed number of independent "voice slots", picks which slot each
// new note attack should use (preferring a slot with no other currently-
// active instance of the same pitch) and remembers the assignment by the
// note's own unique id, so a later release call can be routed back to
// exactly the slot its attack landed on.

export type VoiceAssignment = { voice: number; pitch: string }

export class VoiceAllocator {
  private readonly size: number
  private nextCursor = 0
  /** Per-voice: pitch -> count of currently un-released attacks of that pitch. */
  private readonly busyPitchCount: Map<string, number>[]
  /** noteId -> which voice/pitch it's currently assigned to. */
  private readonly assignment = new Map<string, VoiceAssignment>()

  constructor(size: number) {
    if (size < 1) throw new Error("VoiceAllocator size must be >= 1")
    this.size = size
    this.busyPitchCount = Array.from({ length: size }, () => new Map<string, number>())
  }

  /** Number of currently-unreleased note ids being tracked. */
  get activeCount(): number {
    return this.assignment.size
  }

  /** Which voice a still-active note id is assigned to, or null if not active. */
  voiceFor(noteId: string): number | null {
    return this.assignment.get(noteId)?.voice ?? null
  }

  /**
   * Assign a voice for a new attack of `pitch` identified by `noteId`.
   * Prefers a voice with no other currently-active instance of `pitch`;
   * falls back to round-robin voice stealing if every voice is already busy
   * with this exact pitch (more simultaneous overlaps than pool size).
   */
  attack(noteId: string, pitch: string): number {
    const voice = this.pickVoice(pitch)
    this.assignment.set(noteId, { voice, pitch })
    this.markBusy(voice, pitch)
    return voice
  }

  /**
   * Release the voice assigned to `noteId`. Returns the assignment that was
   * released, or null if `noteId` has no active assignment (already
   * released, or never attacked) — callers should treat that as a no-op.
   */
  release(noteId: string): VoiceAssignment | null {
    const a = this.assignment.get(noteId)
    if (!a) return null
    this.assignment.delete(noteId)
    this.markFree(a.voice, a.pitch)
    return a
  }

  /** Forget every assignment (used for a panic-release across all voices). */
  releaseAll(): void {
    this.assignment.clear()
    for (const m of this.busyPitchCount) m.clear()
  }

  private pickVoice(pitch: string): number {
    for (let k = 0; k < this.size; k++) {
      const idx = (this.nextCursor + k) % this.size
      if (!this.busyPitchCount[idx].get(pitch)) {
        this.nextCursor = (idx + 1) % this.size
        return idx
      }
    }
    const idx = this.nextCursor
    this.nextCursor = (idx + 1) % this.size
    return idx
  }

  private markBusy(voice: number, pitch: string): void {
    const counts = this.busyPitchCount[voice]
    counts.set(pitch, (counts.get(pitch) ?? 0) + 1)
  }

  private markFree(voice: number, pitch: string): void {
    const counts = this.busyPitchCount[voice]
    const n = (counts.get(pitch) ?? 1) - 1
    if (n <= 0) counts.delete(pitch)
    else counts.set(pitch, n)
  }
}
