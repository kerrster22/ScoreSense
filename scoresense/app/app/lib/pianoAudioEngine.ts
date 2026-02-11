"use client"

import * as Tone from "tone"

export interface Note {
  id?: number | string
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

const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/"

/**
 * Main Piano Audio Engine with sustain pedal support
 */
export class PianoAudioEngine {
  private sampler: Tone.Sampler | null = null
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

  // Sustain pedal tracking
  private pedalDown: boolean = false
  private heldByPedal: Map<string, { releaseTime: number }> = new Map()
  private heldCounts: Map<string, number> = new Map() // for note overlaps

  // Loop state
  private loopEnabled: boolean = false
  private loopStartSec: number = 0
  private loopEndSec: number = 0
  private isLoopJumping: boolean = false

  // Debug
  private debug: boolean = false

  async load(): Promise<void> {
    try {
      // NOTE: Do NOT call Tone.start() here.
      // Browsers block AudioContext creation outside a user gesture.
      // Tone.start() is called in play() which runs inside a click handler.

      console.log("Loading Salamander Grand Piano samples from CDN...")

      // Create sampler with CDN-hosted Salamander samples
      const samplerPromise = new Promise<void>((resolve, reject) => {
        let timeout: NodeJS.Timeout
        
        this.sampler = new Tone.Sampler({
          urls: SALAMANDER_SAMPLES,
          baseUrl: SALAMANDER_BASE_URL,
          onload: () => {
            clearTimeout(timeout)
            console.log("Salamander piano samples loaded successfully")
            this.state = { status: "ready", error: null }
            resolve()
          },
          onerror: (error: Error) => {
            clearTimeout(timeout)
            const errorMsg = `Failed to load piano samples: ${error.message}`
            console.error(errorMsg)
            this.state = { status: "error", error: errorMsg }
            reject(new Error(errorMsg))
          },
        }).toDestination()

        // Timeout after 30 seconds (CDN loading can take a moment)
        timeout = setTimeout(() => {
          const timeoutMsg = "Sampler load timeout after 30 seconds"
          console.error(timeoutMsg)
          this.state = { status: "error", error: timeoutMsg }
          reject(new Error(timeoutMsg))
        }, 30000)
      })

      await samplerPromise
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
    this.pedalDown = this.pedalEvents.length > 0 && this.pedalEvents[0]?.down ? true : false
    this.scheduleNotes()
  }

  /**
   * Internal: Schedule all notes with optional sustain pedal support
   * Creates separate attack and release scheduling with pedal-aware release times.
   */
  private scheduleNotes(): void {
    // Cancel existing parts
    if (this.attackPart) {
      this.attackPart.stop()
      this.attackPart.dispose()
    }
    if (this.releasePart) {
      this.releasePart.stop()
      this.releasePart.dispose()
    }
    if (this.pedalPart) {
      this.pedalPart.stop()
      this.pedalPart.dispose()
    }

    if (!this.sampler || this.notes.length === 0) return

    // Build pedal state map: time -> isDown
    const pedalStateMap = new Map<number, boolean>()
    for (const pe of this.pedalEvents) {
      pedalStateMap.set(pe.time, pe.down)
    }

    // ========= ATTACK SCHEDULING =========
    // Group notes by startTime for chords
    const attackEvents: Array<[number, Note[]]> = []
    const attackTimeMap = new Map<number, Note[]>()

    for (const note of this.notes) {
      const scheduledTime = note.startTime / this.basePlaybackRate
      if (!attackTimeMap.has(scheduledTime)) {
        attackTimeMap.set(scheduledTime, [])
      }
      attackTimeMap.get(scheduledTime)!.push(note)
    }

    for (const [time, notes] of Array.from(attackTimeMap.entries()).sort((a, b) => a[0] - b[0])) {
      attackEvents.push([time, notes])
    }

    // Create attack Part
    this.attackPart = new Tone.Part((time, eventNotes: Note[]) => {
      for (const note of eventNotes) {
        const vel = note.velocity ?? 0.8
        this.sampler!.triggerAttack(note.note, time, vel)
        if (this.debug) console.log(`[Pedal] triggerAttack: ${note.note} at ${time.toFixed(3)}s`)
      }
    }, attackEvents)

    // ========= RELEASE SCHEDULING =========
    // For each note, compute its release time (may be delayed by pedal)
    const releaseEvents: Array<[number, Note[]]> = []
    const releaseTimeMap = new Map<number, Note[]>()

    for (const note of this.notes) {
      const nominalReleaseTime = note.startTime + note.duration
      let actualReleaseTime = nominalReleaseTime

      // Check if pedal is down at the nominal release time
      let pedalAtRelease = false
      if (this.pedalEvents.length > 0) {
        // Find the pedal state just before/at the release time
        let lastPedalState = this.pedalDown // initial state at t=0
        for (const pe of this.pedalEvents) {
          if (pe.time <= nominalReleaseTime) {
            lastPedalState = pe.down
          } else {
            break
          }
        }
        pedalAtRelease = lastPedalState

        // If pedal is down, find the next pedal-up event
        if (pedalAtRelease) {
          for (const pe of this.pedalEvents) {
            if (pe.time > nominalReleaseTime && !pe.down) {
              actualReleaseTime = pe.time
              break
            }
          }
        }
      }

      const scheduledReleaseTime = actualReleaseTime / this.basePlaybackRate
      if (!releaseTimeMap.has(scheduledReleaseTime)) {
        releaseTimeMap.set(scheduledReleaseTime, [])
      }
      releaseTimeMap.get(scheduledReleaseTime)!.push(note)
    }

    for (const [time, notes] of Array.from(releaseTimeMap.entries()).sort((a, b) => a[0] - b[0])) {
      releaseEvents.push([time, notes])
    }

    // Create release Part
    this.releasePart = new Tone.Part((time, eventNotes: Note[]) => {
      for (const note of eventNotes) {
        this.sampler!.triggerRelease(note.note, time)
        if (this.debug) console.log(`[Pedal] triggerRelease: ${note.note} at ${time.toFixed(3)}s`)
      }
    }, releaseEvents)

    // ========= PEDAL CHANGE SCHEDULING =========
    // Schedule pedal changes to track state (for debugging)
    const pedalChangeEvents: Array<[number, PedalEvent]> = []
    for (const pe of this.pedalEvents) {
      const scheduledTime = pe.time / this.basePlaybackRate
      pedalChangeEvents.push([scheduledTime, pe])
    }

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
  }

  /**
   * Start playback (must be called from a user gesture like click)
   */
  async play(): Promise<void> {
    if (this.state.status !== "ready" || !this.sampler) {
      throw new Error(`Cannot play: engine status is ${this.state.status}`)
    }

    // Ensure audio context is started (required before Transport.start)
    await Tone.start()
    
    // Start transport if it's stopped
    if (Tone.Transport.state === "stopped") {
      Tone.Transport.start()
    } else if (Tone.Transport.state === "paused") {
      // Resume from pause
      Tone.Transport.start()
    }
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
    
    // Release all held notes immediately
    if (this.sampler) {
      this.sampler.triggerRelease(Array.from(this.heldByPedal.keys()), 0)
    }
    
    // Reset pedal state
    this.pedalDown = false
    this.heldByPedal.clear()
    this.heldCounts.clear()
    
    this.rescheduleNotes() // Re-schedule from the beginning
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
   */
  setLoop(opts: { enabled: boolean; startSec?: number; endSec?: number }): void {
    this.loopEnabled = opts.enabled
    if (opts.startSec !== undefined) this.loopStartSec = Math.max(0, opts.startSec)
    if (opts.endSec !== undefined) this.loopEndSec = Math.max(0, opts.endSec)

    // Ensure start < end
    if (this.loopStartSec >= this.loopEndSec) {
      this.loopEnabled = false
    }
  }

  /** Returns true if the loop is active. */
  isLooping(): boolean {
    return this.loopEnabled
  }

  /**
   * Must be called once per animation frame while playing.
   * Returns true if a loop-wrap occurred (so the caller can update UI immediately).
   */
  tickLoop(): boolean {
    if (!this.loopEnabled || this.isLoopJumping) return false
    const pos = this.getTime()
    if (pos >= this.loopEndSec) {
      this.isLoopJumping = true
      this.seek(this.loopStartSec, { resume: true })
      this.isLoopJumping = false
      return true
    }
    return false
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

  /**
   * Set UI tempo and reschedule notes to play at adjusted rates
   * Rule: uiTempo 100 = 0.75x playback speed
   * playbackRate = (uiTempo / 100) * 0.75
   * 
   * Lower playback rate means faster playback (notes are closer together in transport time).
   */
  setTempo(uiTempo: number): void {
    this.uiTempo = uiTempo
    const rate = (uiTempo / 100) * 0.75
    
    // If we're currently playing, we need to preserve position and tempo
    const wasPlaying = Tone.Transport.state === "started"
    const currentTime = Tone.Transport.seconds
    
    // Update the playback rate
    this.basePlaybackRate = rate
    
    // Reschedule notes with new timing
    this.scheduleNotes()
    
    // If we were playing, restore approximately the same position
    if (wasPlaying) {
      // currentTime is in old-rate transport time, convert to piece time, then back to new-rate transport time
      const pieceTime = currentTime * this.basePlaybackRate
      Tone.Transport.seconds = pieceTime / rate
    }
    
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
    if (this.attackPart) {
      this.attackPart.stop()
      this.attackPart.dispose()
      this.attackPart = null
    }
    if (this.releasePart) {
      this.releasePart.stop()
      this.releasePart.dispose()
      this.releasePart = null
    }
    if (this.pedalPart) {
      this.pedalPart.stop()
      this.pedalPart.dispose()
      this.pedalPart = null
    }
    if (this.sampler) {
      this.sampler.dispose()
      this.sampler = null
    }
    this.heldByPedal.clear()
    this.heldCounts.clear()
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
