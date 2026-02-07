"use client"

import * as Tone from "tone"

/**
 * PianoAudioEngine: Tone.js-based piano audio playback with sample-based synthesis
 * 
 * Key features:
 * - Uses Tone.Sampler with Salamander Grand Piano samples from CDN
 * - Schedules notes using Tone.Part for perfect timing
 * - Supports chords (multiple notes at same startTime)
 * - Keeps long notes visible and audible
 * - Tempo mapping: uiTempo 100 = 0.75x playback speed
 * - Transport.seconds is the single source of truth for time
 */

export interface Note {
  id?: number
  note: string // e.g., "C4", "C#4", "Ab3"
  hand?: string
  startTime: number // in seconds
  duration: number // in seconds
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
 * Main Piano Audio Engine
 */
export class PianoAudioEngine {
  private sampler: Tone.Sampler | null = null
  private part: Tone.Part | null = null
  private state: PianoAudioEngineState = {
    status: "loading",
    error: null,
  }
  private notes: Note[] = []
  private basePlaybackRate: number = 1
  private uiTempo: number = 100

  // Loop state
  private loopEnabled: boolean = false
  private loopStartSec: number = 0
  private loopEndSec: number = 0
  private isLoopJumping: boolean = false // guard to prevent re-entrant loop wraps

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
   * Set notes to be played and reschedule them
   */
  setNotes(newNotes: Note[]): void {
    this.notes = newNotes
    this.scheduleNotes()
  }

  /**
   * Internal: Schedule all notes using Tone.Part
   * Notes are scheduled at adjusted times based on current playback rate
   */
  private scheduleNotes(): void {
    // Cancel existing part
    if (this.part) {
      this.part.stop()
      this.part.dispose()
    }

    if (!this.sampler || this.notes.length === 0) return

    // Group notes by startTime for chord handling
    const events: Array<[number, Note[]]> = []
    const timeMap = new Map<number, Note[]>()

    // Apply playback rate scaling to scheduling times
    // Higher rate = faster playback = schedule notes earlier (divide time by rate)
    for (const note of this.notes) {
      const scheduledTime = note.startTime / this.basePlaybackRate
      if (!timeMap.has(scheduledTime)) {
        timeMap.set(scheduledTime, [])
      }
      timeMap.get(scheduledTime)!.push(note)
    }

    // Convert to sorted events array
    for (const [time, notes] of Array.from(timeMap.entries()).sort((a, b) => a[0] - b[0])) {
      events.push([time, notes])
    }

    // Create Part with all events
    this.part = new Tone.Part((time, eventNotes: Note[]) => {
      for (const note of eventNotes) {
        // Also scale the duration by the playback rate
        const scaledDuration = note.duration / this.basePlaybackRate
        this.sampler!.triggerAttackRelease(note.note, scaledDuration, time)
      }
    }, events)

    // Start part when transport starts
    this.part.start(0)
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
    if (this.part) {
      this.part.stop()
      this.part.dispose()
      this.part = null
    }
    if (this.sampler) {
      this.sampler.dispose()
      this.sampler = null
    }
  }

  /**
   * Internal: Reschedule notes (used when resetting)
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
