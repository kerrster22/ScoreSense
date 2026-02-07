"use client"

import * as Tone from "tone"

/**
 * PianoAudioEngine: Tone.js-based piano audio playback with sample-based synthesis
 * 
 * Key features:
 * - Uses Tone.Sampler with MP3 samples from /public/piano-mp3
 * - Automatically detects note naming convention (C#4 vs Cs4)
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

type NamingScheme = "sharp" | "flat" // "C#4" vs "Db4"
type SamplingStatus = "loading" | "ready" | "error"

export interface PianoAudioEngineState {
  status: SamplingStatus
  error: string | null
}

/**
 * Generates all 88 piano keys (A0 to C8) as Tone.js note names
 */
function generatePianoNotes(): string[] {
  const notes: string[] = []
  const noteOrder = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

  // Start from A0 (MIDI 21)
  let octave = 0
  let startIndex = 9 // A is at index 9 in noteOrder

  for (let i = 0; i < 88; i++) {
    const noteIndex = (startIndex + i) % 12
    const currentOctave = octave + Math.floor((startIndex + i) / 12)
    notes.push(`${noteOrder[noteIndex]}${currentOctave}`)
  }

  return notes
}

/**
 * Detects which naming convention is used by the sample files
 * Returns "sharp" for C#4.mp3 or "flat" for Db4.mp3
 */
async function detectNamingScheme(): Promise<NamingScheme> {
  const testNotes = [
    { name: "C#4", sharp: "C#4.mp3", flat: "Db4.mp3" },
    { name: "F#3", sharp: "F#3.mp3", flat: "Gb3.mp3" },
  ]

  for (const test of testNotes) {
    try {
      // Encode '#' so it isn't treated as a URL fragment identifier
      const sharpResponse = await fetch(`/piano-mp3/${encodeURIComponent(test.sharp)}`, { method: "HEAD" })
      if (sharpResponse.ok) return "sharp"

      const flatResponse = await fetch(`/piano-mp3/${encodeURIComponent(test.flat)}`, { method: "HEAD" })
      if (flatResponse.ok) return "flat"
    } catch (e) {
      // Continue to next test
    }
  }

  // Default to flat if detection fails
  console.warn("Could not detect naming scheme, defaulting to 'flat'")
  return "flat"
}

/**
 * Converts note name to match the detected naming scheme
 * E.g., "C#4" -> "Db4" if scheme is "flat", "Db4" -> "C#4" if scheme is "sharp"
 */
function convertNoteToScheme(noteName: string, scheme: NamingScheme): string {
  const match = noteName.match(/^([A-G])(#|b)?(\d)$/)
  if (!match) return noteName // invalid format, return as-is

  const [, baseNote, accidental, octave] = match
  const notes = ["C", "D", "E", "F", "G", "A", "B"]
  const baseIdx = notes.indexOf(baseNote)

  // Already in target scheme?
  if (scheme === "sharp" && accidental === "#") return noteName
  if (scheme === "flat" && accidental === "b") return noteName
  if (!accidental) return noteName // natural note, no conversion needed

  // Need to convert
  if (scheme === "sharp" && accidental === "b") {
    // Db -> C#: go down one note and add sharp
    const nextIdx = (baseIdx - 1 + 7) % 7
    return notes[nextIdx] + "#" + octave
  } else if (scheme === "flat" && accidental === "#") {
    // C# -> Db: go up one note and add flat
    const nextIdx = (baseIdx + 1) % 7
    return notes[nextIdx] + "b" + octave
  }

  return noteName
}

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
  private namingScheme: NamingScheme = "flat"
  private notes: Note[] = []
  private basePlaybackRate: number = 1
  private uiTempo: number = 100

  async load(): Promise<void> {
    try {
      // NOTE: Do NOT call Tone.start() here.
      // Browsers block AudioContext creation outside a user gesture.
      // Tone.start() is called in play() which runs inside a click handler.
      
      // Detect naming scheme
      this.namingScheme = await detectNamingScheme()
      console.log(`Piano samples detected using '${this.namingScheme}' naming scheme`)

      // Build URL map for all 88 keys
      const pianoNotes = generatePianoNotes()
      const urls: Record<string, string> = {}

      for (const noteName of pianoNotes) {
        const sampleName = convertNoteToScheme(noteName, this.namingScheme)
        urls[noteName] = `/piano-mp3/${sampleName}.mp3`
      }

      // Create sampler with proper error handling
      const samplerPromise = new Promise<void>((resolve, reject) => {
        let timeout: NodeJS.Timeout
        
        this.sampler = new Tone.Sampler({
          urls,
          baseUrl: "/",
          onload: () => {
            clearTimeout(timeout)
            console.log("Piano samples loaded successfully")
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

        // Timeout after 10 seconds
        timeout = setTimeout(() => {
          const timeoutMsg = "Sampler load timeout after 10 seconds"
          console.error(timeoutMsg)
          this.state = { status: "error", error: timeoutMsg }
          reject(new Error(timeoutMsg))
        }, 10000)
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
   * Seek to a specific time (in "piece seconds", accounting for playback rate)
   */
  seek(seconds: number): void {
    // Convert piece time to transport time
    const transportTime = seconds / this.basePlaybackRate
    Tone.Transport.seconds = transportTime
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
