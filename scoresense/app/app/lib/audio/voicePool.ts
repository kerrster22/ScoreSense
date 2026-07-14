"use client"

import * as Tone from "tone"
import { VoiceAllocator } from "./voiceAllocator"

// =============================================================================
// SamplerVoicePool
// =============================================================================
// Root cause this exists to fix: Tone.Sampler (see node_modules/tone/Tone/
// instrument/Sampler.ts) keeps exactly one bucket of active voices PER PITCH
// (`_activeSources: Map<midi, ToneBufferSource[]>`), and `triggerRelease(pitch)`
// stops *every* voice in that pitch's bucket at once, then clears it. A single
// shared Sampler therefore cannot correctly play two overlapping instances of
// the same pitch: whichever `triggerRelease` call lands first (often the
// earlier note's own scheduled release, firing after the second note has
// already attacked) silences both — the classic "repeated note gets eaten"
// bug in fast passages (rapid same-pitch repeats, e.g. Liszt's La Campanella).
//
// The fix is a small pool of independent Tone.Sampler instances sharing one
// set of decoded sample buffers (no extra network/decode cost). Each overlap-
// ping instance of a pitch is routed to a different pool voice (decision made
// by VoiceAllocator, kept Tone.js-free so it's directly unit testable), so
// each has its own `_activeSources` bucket and releasing one can never touch
// another's still-ringing voice. Every attack/release call is keyed by the
// caller's stable per-instance note id (NOT pitch) — pitch is only used
// internally to pick a free voice.
// =============================================================================

export type VoicePoolLoadOptions = {
  urls: Record<string, string>
  baseUrl: string
  attack: number
  release: number
}

export class SamplerVoicePool {
  private voices: Tone.Sampler[] = []
  private allocator: VoiceAllocator

  constructor(private readonly size = 8) {
    this.allocator = new VoiceAllocator(size)
  }

  get loaded(): boolean {
    return this.voices.length > 0
  }

  /**
   * Load one shared set of decoded sample buffers, then build `size`
   * independent Samplers that all reference those same buffers — each
   * Sampler still owns its own voice/gain graph, but none of them re-fetch
   * or re-decode audio.
   */
  async load(opts: VoicePoolLoadOptions): Promise<void> {
    const rawBuffers = await new Promise<Tone.ToneAudioBuffers>((resolve, reject) => {
      const buffers: Tone.ToneAudioBuffers = new Tone.ToneAudioBuffers({
        urls: opts.urls,
        baseUrl: opts.baseUrl,
        onload: () => resolve(buffers),
        onerror: (err: Error) => reject(err),
      })
    })

    const sharedUrls: Record<string, Tone.ToneAudioBuffer> = {}
    for (const key of Object.keys(opts.urls)) {
      sharedUrls[key] = rawBuffers.get(key)
    }

    this.voices = []
    for (let i = 0; i < this.size; i++) {
      this.voices.push(
        new Tone.Sampler({
          urls: sharedUrls,
          attack: opts.attack,
          release: opts.release,
        })
      )
    }
  }

  connect(node: Tone.ToneAudioNode): void {
    for (const v of this.voices) v.connect(node)
  }

  setVolumeDb(db: number): void {
    for (const v of this.voices) v.volume.value = db
  }

  /** Attack a new note instance, identified by its own stable, unique id. */
  triggerAttack(noteId: string, pitch: string, time: number, velocity: number): void {
    if (this.voices.length === 0) return
    const voice = this.allocator.attack(noteId, pitch)
    this.voices[voice].triggerAttack(pitch, time, velocity)
  }

  /** Release exactly the voice that `noteId`'s triggerAttack landed on. */
  triggerRelease(noteId: string, time: number): void {
    const a = this.allocator.release(noteId)
    if (!a) return
    this.voices[a.voice].triggerRelease(a.pitch, time)
  }

  /** One-off attack + scheduled release, for live (non-Part-scheduled) input. */
  triggerAttackRelease(noteId: string, pitch: string, time: number, durationSec: number, velocity: number): void {
    if (this.voices.length === 0) return
    const voice = this.allocator.attack(noteId, pitch)
    this.voices[voice].triggerAttack(pitch, time, velocity)
    this.voices[voice].triggerRelease(pitch, time + durationSec)
    this.allocator.release(noteId)
  }

  /** Panic-release every voice on every pool member (used by stop()/seek()). */
  releaseAll(time: number): void {
    for (const v of this.voices) v.releaseAll(time)
    this.allocator.releaseAll()
  }

  dispose(): void {
    for (const v of this.voices) v.dispose()
    this.voices = []
    this.allocator.releaseAll()
  }
}
