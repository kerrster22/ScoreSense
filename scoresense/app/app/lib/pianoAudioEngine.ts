"use client"

import * as Tone from "tone"
import { SamplerVoicePool } from "./audio/voicePool"
import { computeNoteScheduling, snapTime } from "./audio/noteScheduling"

export interface Note {
  /** Stable, unique per note *instance* — required so overlapping notes of
   *  the same pitch (rapid repeats, e.g. La Campanella) can be attacked and
   *  released independently instead of colliding. See SamplerVoicePool. */
  id: string | number
  note: string // e.g., "C4", "C#4", "Ab3"
  hand?: string
  startTime: number // in seconds
  duration: number // in seconds
  velocity?: number
}

export type PedalEvent = {
  time: number
  down: boolean
  value: number
}

type SamplingStatus = "loading" | "ready" | "error"

export interface PianoAudioEngineState {
  status: SamplingStatus
  error: string | null
}

/**
 * Sparse sample map for Salamander Grand Piano (CDN-hosted).
 * The Tone.Sampler interpolates between these ~3-semitone-apart samples
 * to cover all 88 keys without needing every single file.
 * 
 * CDN filenames use "s" for sharps: Ds1.mp3, Fs1.mp3, etc.
 */
const SALAMANDER_SAMPLES: Record<string, string> = {
  "A0": "A0.mp3",
  "C1": "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  "A1": "A1.mp3",
  "C2": "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  "A2": "A2.mp3",
  "C3": "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  "A3": "A3.mp3",
  "C4": "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  "A4": "A4.mp3",
  "C5": "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  "A5": "A5.mp3",
  "C6": "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  "A6": "A6.mp3",
  "C7": "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  "A7": "A7.mp3",
  "C8": "C8.mp3",
}

const SALAMANDER_BASE_URL = "/salamander/"

/**
 * Main Piano Audio Engine with sustain pedal support
 */
export class PianoAudioEngine {
  private voicePool: SamplerVoicePool | null = null
  private compressor: Tone.Compressor | null = null
  private eq: Tone.EQ3 | null = null
  private reverb: Tone.Reverb | null = null
  private limiter: Tone.Limiter | null = null
  private attackPart: Tone.Part | null = null
  private releasePart: Tone.Part | null = null
  private pedalPart: Tone.Part | null = null
  private state: PianoAudioEngineState = {
    status: "loading",
    error: null,
  }
  private notes: Note[] = []
  private pedalEvents: PedalEvent[] = []
  private basePlaybackRate: number = 1
  private uiTempo: number = 100

  // Synthetic ids for one-off live notes (playNoteNow), which aren't part of
  // the scheduled piece and so have no pre-existing note id of their own.
  private liveNoteSeq = 0

  // Sustain pedal tracking
  private pedalDown: boolean = false

  // Loop state
  private loopEnabled: boolean = false
  private loopStartSec: number = 0
  private loopEndSec: number = 0
  private isLoopJumping: boolean = false
  private loopRepeatTarget: number | null = null
  private loopRepeatCount: number = 0

  // Metronome
  private metronomeLoop: Tone.Loop | null = null
  private metronomeSynth: Tone.Synth | null = null
  private metronomeEnabled: boolean = false
  private metronomeBpm: number = 120
  private countInBeats: number = 0

  // Debug
  private debug: boolean = false

  async load(): Promise<void> {
    try {
      // NOTE: Do NOT call Tone.start() here.
      // Browsers block AudioContext creation outside a user gesture.
      // Tone.start() is called in play() which runs inside a click handler.

      console.log("Loading Salamander Grand Piano samples...")

      // Build the audio graph: sampler → compressor → reverb → limiter → destination
      // Compressor prevents level buildup when many pedal-sustained notes accumulate.
      // Reverb wet is kept low to avoid tails from different notes washing together.
      this.compressor = new Tone.Compressor({ threshold: -24, ratio: 2, attack: 0.005, release: 0.3, knee: 10 })
      this.eq = new Tone.EQ3({ low: 2, mid: 0, high: -2 })
      this.reverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.01, wet: 0.28 })
      await this.reverb.generate()
      this.limiter = new Tone.Limiter(-3)
      this.eq.connect(this.compressor)
      this.compressor.connect(this.reverb)
      this.reverb.connect(this.limiter)
      this.limiter.toDestination()

      // A small pool of Samplers sharing one set of decoded buffers, so
      // overlapping instances of the same pitch get independent voices —
      // see SamplerVoicePool for why a single Tone.Sampler can't do this.
      this.voicePool = new SamplerVoicePool()

      let timeout: NodeJS.Timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Sampler load timeout after 30 seconds")), 30000)
      })

      await Promise.race([
        this.voicePool.load({
          urls: SALAMANDER_SAMPLES,
          baseUrl: SALAMANDER_BASE_URL,
          attack: 0.004,
          release: 0.6,
        }),
        timeoutPromise,
      ])
      clearTimeout(timeout!)

      // Connect: voice pool → eq → compressor → reverb → limiter
      this.voicePool.connect(this.eq!)

      console.log("Salamander piano samples loaded successfully")
      this.state = { status: "ready", error: null }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error"
      console.error("Piano engine load error:", errorMsg)
      this.state = { status: "error", error: errorMsg }
      throw error
    }
  }

  /**
   * Set notes + optional pedal events and reschedule them
   */
  setNotes(newNotes: Note[], pedalEvents?: PedalEvent[]): void {
    this.notes = newNotes
    this.pedalEvents = pedalEvents ?? []
    // Initialize pedal state from pedal events (what state is it in at t=0?)
    this.pedalDown = this.getPedalStateAt(0)
    this.scheduleNotes()
  }

  /**
   * Sustain pedal state at a given piece-time, derived from the immutable
   * pedalEvents list (a recorded "down" event means the pedal was UP before
   * that instant, so the state defaults to false until the first event).
   */
  private getPedalStateAt(t: number): boolean {
    let state = false
    for (const pe of this.pedalEvents) {
      if (pe.time <= t) state = pe.down
      else break
    }
    return state
  }

  /**
   * Public: sustain pedal state at the current playback position.
   * Computed on demand from pedalEvents rather than a lazily-updated flag,
   * so it stays correct immediately after seek()/pause()/resume().
   */
  getPedalState(): boolean {
    return this.getPedalStateAt(this.getTime())
  }

  /**
   * Public: 0..1 phase within the current beat, for a visual metronome pulse.
   * Takes the piece's bpm explicitly (rather than relying on metronomeBpm,
   * which is only ever set when the audible metronome is toggled on) so the
   * beat-flash stays in sync even if the click track has never been enabled.
   */
  getBeatPhase(bpm: number): number {
    const secPerBeat = 60 / (Math.max(20, bpm) * this.basePlaybackRate)
    if (!isFinite(secPerBeat) || secPerBeat <= 0) return 0
    const t = Tone.Transport.seconds
    return (t % secPerBeat) / secPerBeat
  }

  /**
   * Internal: Schedule all notes with optional sustain pedal support
   * Creates separate attack and release scheduling with pedal-aware release times.
   */
  private scheduleNotes(): void {
    // Cancel existing parts
    // Pass an explicit 0 rather than relying on Part.stop()'s default "now"
    // argument: Tone computes that via a ticks<->seconds round-trip on the
    // Transport's clock, which can come out as a tiny negative float (e.g.
    // -1.09e-11) right after Transport.seconds is reset to 0 — and Part.stop()
    // rejects any negative value. The part is disposed immediately after
    // anyway, so the exact stop time is irrelevant.
    if (this.attackPart) {
      this.attackPart.stop(0)
      this.attackPart.dispose()
    }
    if (this.releasePart) {
      this.releasePart.stop(0)
      this.releasePart.dispose()
    }
    if (this.pedalPart) {
      this.pedalPart.stop(0)
      this.pedalPart.dispose()
    }

    if (!this.voicePool || this.notes.length === 0) return

    // One Part event per note instance (never grouped/bucketed by time or
    // pitch) so that two notes of the same pitch starting a few ms apart —
    // e.g. the rapid repeated notes in Liszt's La Campanella — are always
    // scheduled, and released, as fully independent voices via the
    // SamplerVoicePool, keyed by each note's own stable id rather than by
    // pitch. Release times no longer need clamping against the next
    // same-pitch attack (as the old single-Sampler design required): each
    // note's release only ever targets the voice its own attack landed on,
    // so an overlapping repeat rings on its own voice instead of colliding.
    const { attackEvents, releaseEvents } = computeNoteScheduling(
      this.notes,
      this.pedalEvents,
      this.basePlaybackRate,
      (t) => this.getPedalStateAt(t)
    )

    this.attackPart = new Tone.Part((time, note: Note) => {
      const vel = note.velocity ?? 0.8
      this.voicePool!.triggerAttack(String(note.id), note.note, time, vel)
      if (this.debug) console.log(`[Voice] triggerAttack: ${note.note} (id=${note.id}) at ${time.toFixed(3)}s`)
    }, attackEvents.map((e): [number, Note] => [e.time, e.note]))

    this.releasePart = new Tone.Part((time, note: Note) => {
      this.voicePool!.triggerRelease(String(note.id), time)
      if (this.debug) console.log(`[Voice] triggerRelease: ${note.note} (id=${note.id}) at ${time.toFixed(3)}s`)
    }, releaseEvents.map((e): [number, Note] => [e.time, e.note]))

    // ========= PEDAL CHANGE SCHEDULING =========
    // Schedule pedal changes to track state (for debugging)
    const pedalChangeEvents: Array<[number, PedalEvent]> = this.pedalEvents.map((pe) => [
      snapTime(pe.time / this.basePlaybackRate),
      pe,
    ])

    this.pedalPart = new Tone.Part((time, evt: PedalEvent) => {
      this.pedalDown = evt.down
      if (this.debug) {
        console.log(`[Pedal] State: ${evt.down ? "DOWN" : "UP"} at ${time.toFixed(3)}s (value: ${evt.value})`)
      }
    }, pedalChangeEvents)

    // Start all parts when transport starts
    this.attackPart.start(0)
    this.releasePart.start(0)
    if (pedalChangeEvents.length > 0) {
      this.pedalPart.start(0)
    }
    this._rebuildMetronomeLoop()
  }

  /**
   * Start playback (must be called from a user gesture like click)
   */
  async play(): Promise<void> {
    if (this.state.status !== "ready" || !this.voicePool) {
      throw new Error(`Cannot play: engine status is ${this.state.status}`)
    }

    // Ensure audio context is started (required before Transport.start)
    await Tone.start()

    // Count-in only applies to a genuine fresh start (position 0, not yet
    // running) — not to resuming a mid-piece pause, which would otherwise
    // click 4 beats every time the user hits Play/Pause.
    const isFreshStart = Tone.Transport.state === "stopped" && Tone.Transport.seconds === 0
    if (isFreshStart && this.countInBeats > 0) {
      this.playCountIn()
      return
    }

    // Start transport if it's stopped
    if (Tone.Transport.state === "stopped") {
      Tone.Transport.start()
    } else if (Tone.Transport.state === "paused") {
      // Resume from pause
      Tone.Transport.start()
    }
  }

  /** Number of metronome clicks to play before a fresh start begins advancing. 0 disables. */
  setCountIn(beats: number): void {
    this.countInBeats = Math.max(0, Math.floor(beats))
  }

  private ensureMetronomeSynth(): Tone.Synth {
    if (!this.metronomeSynth) {
      this.metronomeSynth = new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
      })
      this.metronomeSynth.volume.value = -4
      this.metronomeSynth.toDestination()
    }
    return this.metronomeSynth
  }

  /**
   * Clicks countInBeats times at the metronome's tempo using the AudioContext
   * clock directly (not the Transport, which hasn't started yet), then starts
   * the Transport exactly when the last click finishes. This leaves
   * Transport.seconds/seek/tempo math completely untouched — the Transport
   * simply begins later than it would have otherwise.
   */
  private playCountIn(): void {
    const synth = this.ensureMetronomeSynth()
    const secPerBeat = 60 / (this.metronomeBpm * this.basePlaybackRate)
    const now = Tone.now()
    for (let i = 0; i < this.countInBeats; i++) {
      synth.triggerAttackRelease("C7", "64n", now + i * secPerBeat)
    }
    Tone.Transport.start(now + this.countInBeats * secPerBeat)
  }

  /**
   * Pause playback
   */
  pause(): void {
    Tone.Transport.pause()
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    Tone.Transport.stop()
    Tone.Transport.cancel() // Cancel all scheduled notes
    Tone.Transport.seconds = 0

    // Release every ringing voice on every pool member immediately so
    // nothing rings after a stop, even if it was still held by the pedal.
    this.voicePool?.releaseAll(Tone.now())

    // Reset pedal state
    this.pedalDown = false

    this.rescheduleNotes() // Re-schedule from the beginning
  }

  /**
   * Start the transport from its current (already-seeked) position without
   * calling Tone.start() again.  Safe to call from a rAF callback once the
   * AudioContext has already been unlocked by a prior user gesture.
   */
  resumeFromSeek(): void {
    Tone.Transport.start()
  }

  /**
   * Seek to a specific time (in "piece seconds", accounting for playback rate).
   * Cancels all currently scheduled audio events and re-schedules from the new
   * position to avoid stuck/duplicate notes.
   *
   * @param seconds  Target position in piece time
   * @param options  resume – if true, continue playing after seek
   */
  seek(seconds: number, options?: { resume?: boolean }): void {
    const duration = this.getDuration()
    const clamped = Math.max(0, Math.min(seconds, duration))

    const wasPlaying = Tone.Transport.state === "started"

    // Pause transport while we re-position
    if (wasPlaying) {
      Tone.Transport.pause()
    }

    // Cancel any previously-scheduled note events and rebuild the Part
    Tone.Transport.cancel()

    // Release any voices still ringing from before the seek so they don't
    // keep sounding after the jump.
    this.voicePool?.releaseAll(Tone.now())

    // Move transport head
    const transportTime = clamped / this.basePlaybackRate
    Tone.Transport.seconds = transportTime

    // Re-schedule notes from the beginning (Part handles offset via Transport.seconds)
    this.rescheduleNotes()

    // Resume if requested or if we were already playing
    const shouldResume = options?.resume ?? wasPlaying
    if (shouldResume) {
      Tone.Transport.start()
    }
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  /**
   * Enable / disable looping with a given range (in piece-time seconds).
   * @param repeatTarget  Number of wraps to allow before auto-disabling the
   *   loop (undefined/null = loop forever, matching prior behavior). Only
   *   takes effect when (re)enabling the loop — resets the wrap counter.
   */
  setLoop(opts: { enabled: boolean; startSec?: number; endSec?: number; repeatTarget?: number | null }): void {
    this.loopEnabled = opts.enabled
    if (opts.startSec !== undefined) this.loopStartSec = Math.max(0, opts.startSec)
    if (opts.endSec !== undefined) this.loopEndSec = Math.max(0, opts.endSec)

    if (opts.enabled) {
      this.loopRepeatCount = 0
      this.loopRepeatTarget = opts.repeatTarget ?? null
    }

    // Ensure start < end
    if (this.loopStartSec >= this.loopEndSec) {
      this.loopEnabled = false
    }
  }

  /** Returns true if the loop is active. */
  isLooping(): boolean {
    return this.loopEnabled
  }

  /** How many times the current loop has wrapped since it was (re)enabled. */
  getLoopRepeatCount(): number {
    return this.loopRepeatCount
  }

  /**
   * Must be called once per animation frame while playing.
   * Returns "wrapped" if the loop jumped back to its start, "completed" if it
   * just hit its repeat target and disabled itself, or "none" otherwise.
   */
  tickLoop(): "wrapped" | "completed" | "none" {
    if (!this.loopEnabled || this.isLoopJumping) return "none"
    const pos = this.getTime()
    if (pos >= this.loopEndSec) {
      this.loopRepeatCount++
      if (this.loopRepeatTarget !== null && this.loopRepeatCount >= this.loopRepeatTarget) {
        this.loopEnabled = false
        return "completed"
      }
      this.isLoopJumping = true
      // Seek 1.5s before the loop section so notes have time to fall in from
      // the top of the visualizer before the first note hits the strike line.
      const LEAD_IN_SEC = 1.5
      this.seek(Math.max(0, this.loopStartSec - LEAD_IN_SEC), { resume: true })
      this.isLoopJumping = false
      return "wrapped"
    }
    return "none"
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute piece duration from the loaded notes (last note end).
   * Returns 0 when no notes are loaded.
   */
  getDuration(): number {
    if (this.notes.length === 0) return 0
    let maxEnd = 0
    for (const n of this.notes) {
      const end = n.startTime + n.duration
      if (end > maxEnd) maxEnd = end
    }
    return maxEnd
  }

  setTempo(uiTempo: number): void {
    this.uiTempo = uiTempo
    const rate = uiTempo / 100

    const currentTime = Tone.Transport.seconds
    const oldRate = this.basePlaybackRate

    this.basePlaybackRate = rate
    this.scheduleNotes()

    // Re-anchor Transport.seconds to the same piece-time position under the new
    // rate. Must run regardless of play/pause state — otherwise a tempo change
    // made while paused leaves Transport.seconds stale, and resuming jumps the
    // playhead to the wrong position.
    const pieceTime = currentTime * oldRate
    Tone.Transport.seconds = pieceTime / rate

    console.log(`Tempo set to ${uiTempo}% => playback rate ${rate.toFixed(3)}x`)
  }

  /**
   * Get current playback time (in "piece time" accounting for tempo)
   * 
   * Transport.seconds is in "transport time" (affected by playback rate).
   * To get "piece time" (actual time in the score), we multiply by basePlaybackRate.
   */
  getTime(): number {
    return Tone.Transport.seconds * this.basePlaybackRate
  }

  /**
   * Get engine state
   */
  getState(): PianoAudioEngineState {
    return this.state
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    // Pass an explicit 0 rather than relying on Part.stop()'s default "now"
    // argument: Tone computes that via a ticks<->seconds round-trip on the
    // Transport's clock, which can come out as a tiny negative float (e.g.
    // -1.09e-11) right after Transport.seconds is reset to 0 — and Part.stop()
    // rejects any negative value. The part is disposed immediately after
    // anyway, so the exact stop time is irrelevant.
    if (this.attackPart) {
      this.attackPart.stop(0)
      this.attackPart.dispose()
      this.attackPart = null
    }
    if (this.releasePart) {
      this.releasePart.stop(0)
      this.releasePart.dispose()
      this.releasePart = null
    }
    if (this.pedalPart) {
      this.pedalPart.stop(0)
      this.pedalPart.dispose()
      this.pedalPart = null
    }
    if (this.voicePool) {
      this.voicePool.dispose()
      this.voicePool = null
    }
    if (this.compressor) {
      this.compressor.dispose()
      this.compressor = null
    }
    if (this.eq) {
      this.eq.dispose()
      this.eq = null
    }
    if (this.reverb) {
      this.reverb.dispose()
      this.reverb = null
    }
    if (this.limiter) {
      this.limiter.dispose()
      this.limiter = null
    }
    if (this.metronomeLoop) {
      this.metronomeLoop.stop(0)
      this.metronomeLoop.dispose()
      this.metronomeLoop = null
    }
    if (this.metronomeSynth) {
      this.metronomeSynth.dispose()
      this.metronomeSynth = null
    }
  }

  // ---------------------------------------------------------------------------
  // Metronome
  // ---------------------------------------------------------------------------

  /**
   * Enable or disable the metronome click track.
   * @param enabled  Whether the metronome should play
   * @param bpm      Piece BPM at full tempo (engine scales for current UI tempo)
   */
  setMetronome(enabled: boolean, bpm: number): void {
    this.metronomeEnabled = enabled
    this.metronomeBpm = Math.max(20, bpm)
    this._rebuildMetronomeLoop()
  }

  private _rebuildMetronomeLoop(): void {
    if (this.metronomeLoop) {
      this.metronomeLoop.stop(0)
      this.metronomeLoop.dispose()
      this.metronomeLoop = null
    }
    if (!this.metronomeEnabled) return

    const synth = this.ensureMetronomeSynth()

    // Beat interval in transport-seconds.
    // The engine uses basePlaybackRate to slow down notes at reduced tempo,
    // so transport-time runs faster than piece-time. The metronome must match.
    const transportSecPerBeat = 60 / (this.metronomeBpm * this.basePlaybackRate)
    this.metronomeLoop = new Tone.Loop((time) => {
      synth.triggerAttackRelease("C7", "64n", time)
    }, transportSecPerBeat)
    this.metronomeLoop.start(0)
  }

  /**
   * Set master volume. v is 0–1 linear (0 = silent, 1 = full).
   */
  setVolume(v: number): void {
    if (!this.voicePool) return
    this.voicePool.setVolumeDb(v <= 0 ? -Infinity : Tone.gainToDb(v))
  }

  /**
   * Trigger a single one-off note immediately, outside the scheduled
   * Tone.Part system — used by live (non-MIDI) input such as a clicked
   * on-screen key or a computer-keyboard press. Each call gets its own
   * synthetic id so rapid repeats of the same key (real players do this)
   * get independent voices too, same as scheduled playback.
   */
  playNoteNow(note: string, velocity = 0.8, durationSec: number = 0.5): void {
    if (this.state.status !== "ready" || !this.voicePool) return
    const id = `live-${this.liveNoteSeq++}`
    this.voicePool.triggerAttackRelease(id, note, Tone.now(), durationSec, velocity)
  }

  /**
   * Internal: Reschedule notes (used when resetting or seeking)
   */
  private rescheduleNotes(): void {
    this.scheduleNotes()
  }
}

/**
 * Singleton instance
 */
let engine: PianoAudioEngine | null = null

/**
 * Get or create the singleton engine
 */
export function getPianoAudioEngine(): PianoAudioEngine {
  if (!engine) {
    engine = new PianoAudioEngine()
  }
  return engine
}

/**
 * Reset the engine (useful for hot reload)
 */
export function resetPianoAudioEngine(): void {
  if (engine) {
    engine.dispose()
    engine = null
  }
}
