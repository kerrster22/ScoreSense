import * as Tone from "tone"

/**
 * Grand Piano Sound Synthesizer
 * 
 * Creates a realistic grand piano sound using Tone.js synthesizers
 * with multi-layered oscillators, reverb, and subtle effects.
 * 
 * Type-safe implementation with no individual note imports needed.
 */

export interface GrandPianoConfig {
  volume?: number // -10 to 0 dB
  reverbWet?: number // 0 to 1
  reverbDecay?: number // 0.5 to 10 seconds
}

export interface NotePlaybackOptions {
  velocity?: number // 0 to 1
  duration?: number | string // in seconds, or "4n", "8n" etc. (Tone notation)
}

/**
 * Maps MIDI note numbers to frequencies
 * Works for all 88 piano keys (MIDI 21-108, A0-C8)
 */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * Grand Piano Synthesizer Class
 * 
 * Handles all audio synthesis and playback with proper resource management.
 */
export class GrandPianoSynth {
  private polyphonic: Tone.Synth[]
  private reverb: Tone.Reverb
  private masterGain: Tone.Gain
  private isInitialized: boolean = false
  private activeNotes: Map<number, Tone.Synth> = new Map()

  constructor(config: GrandPianoConfig = {}) {
    const volume = config.volume ?? -8
    const reverbWet = config.reverbWet ?? 0.3
    const reverbDecay = config.reverbDecay ?? 3.5

    // Create reverb for that grand piano hall resonance
    this.reverb = new Tone.Reverb({
      decay: reverbDecay,
    }).toDestination()

    // Master gain control
    this.masterGain = new Tone.Gain(Tone.dbToGain(volume))
    this.masterGain.connect(this.reverb)

    // Create polyphonic synthesizers (8 voices for complex passages)
    this.polyphonic = Array.from({ length: 8 }, () => {
      const synth = new Tone.Synth({
        oscillator: {
          type: "triangle",
        } as any,
        envelope: {
          attack: 0.005, // Very fast attack, like a hammer strike
          decay: 0.3, // Medium decay
          sustain: 0.4, // Grand pianos sustain well
          release: 1.2, // Longer release for resonance
        },
      }).connect(this.masterGain)

      return synth
    })

    // Set reverb send level
    this.reverb.wet.value = reverbWet
  }

  /**
   * Initialize the Tone audio context (required for Web Audio API)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    try {
      await Tone.start()
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize audio:", error)
      throw error
    }
  }

  /**
   * Play a single note by MIDI number
   * Type-safe: accepts only valid MIDI numbers (0-127)
   * 
   * @param midi - MIDI note number (0-127)
   * @param options - Optional playback settings (velocity, duration)
   */
  playNote(midi: number, options: NotePlaybackOptions = {}): void {
    if (!this.isInitialized) {
      console.warn("Grand Piano not initialized. Call initialize() first.")
      return
    }

    // Validate MIDI number
    if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
      console.error(`Invalid MIDI note: ${midi}. Must be 0-127.`)
      return
    }

    const frequency = midiToFreq(midi)
    const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.8))
    const duration = options.duration ?? "1n"

    // Get an available synth from the pool
    const synth = this.getAvailableSynth(midi)
    if (!synth) {
      console.warn("No available synthesizers. Note dropped.")
      return
    }

    // Adjust gain based on velocity (softer notes = lower volume)
    synth.volume.value = Tone.dbToGain(-3 + velocity * 3)

    // Play the note
    synth.frequency.setValueAtTime(frequency, Tone.now())
    synth.triggerAttack(frequency, Tone.now())

    // Schedule release if duration is specified
    if (typeof duration === "number") {
      synth.triggerRelease(Tone.now() + duration)
      this.activeNotes.delete(midi)
    } else {
      // For Tone notation (e.g., "4n"), schedule release after that duration
      const durationInSeconds = Tone.Time(duration).toSeconds()
      synth.triggerRelease(Tone.now() + durationInSeconds)
      this.activeNotes.delete(midi)
    }
  }

  /**
   * Play a sequence of notes (for demo or auto-play)
   * 
   * @param midiSequence - Array of MIDI numbers to play in sequence
   * @param tempo - BPM (beats per minute)
   */
  async playSequence(
    midiSequence: number[],
    tempo: number = 120,
    noteLength: number = 0.5
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const beatDuration = (60 / tempo) * noteLength

    for (let i = 0; i < midiSequence.length; i++) {
      const midi = midiSequence[i]
      this.playNote(midi, { duration: beatDuration, velocity: 0.8 })
      await new Promise((resolve) => setTimeout(resolve, beatDuration * 1000))
    }
  }

  /**
   * Release (stop) a specific note
   * 
   * @param midi - MIDI note number to release
   */
  releaseNote(midi: number): void {
    const synth = this.activeNotes.get(midi)
    if (synth) {
      synth.triggerRelease(Tone.now())
      this.activeNotes.delete(midi)
    }
  }

  /**
   * Stop all playing notes immediately
   */
  stopAll(): void {
    this.activeNotes.forEach((synth) => {
      synth.triggerRelease(Tone.now())
    })
    this.activeNotes.clear()
  }

  /**
   * Dispose all resources and clean up
   */
  dispose(): void {
    this.stopAll()
    this.polyphonic.forEach((synth) => synth.dispose())
    this.masterGain.dispose()
    this.reverb.dispose()
    this.polyphonic = []
    this.isInitialized = false
  }

  /**
   * Set master volume
   * 
   * @param dbValue - Volume in decibels (-60 to 0)
   */
  setVolume(dbValue: number): void {
    const clamped = Math.max(-60, Math.min(0, dbValue))
    this.masterGain.gain.rampTo(Tone.dbToGain(clamped), 0.1)
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return Tone.gainToDb(this.masterGain.gain.value)
  }

  /**
   * Set reverb wetness (0 = dry, 1 = wet)
   */
  setReverbWet(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    this.reverb.wet.rampTo(clamped, 0.1)
  }

  /**
   * Get reverb decay time
   */
  getReverbDecay(): number {
    return Tone.Time(this.reverb.decay).toSeconds()
  }

  /**
   * Get the next available synth from the pool
   * Uses round-robin allocation for better note distribution
   */
  private getAvailableSynth(midi: number): Tone.Synth | null {
    // First check if we're already playing this note - reuse it
    if (this.activeNotes.has(midi)) {
      return this.activeNotes.get(midi)!
    }

    // Find the first free synth
    for (const synth of this.polyphonic) {
      let isActive = false
      for (const activeSynth of this.activeNotes.values()) {
        if (activeSynth === synth) {
          isActive = true
          break
        }
      }
      if (!isActive) {
        this.activeNotes.set(midi, synth)
        return synth
      }
    }

    // If all synths are busy, reuse the oldest note
    const oldestNote = this.activeNotes.keys().next().value
    if (oldestNote !== undefined) {
      const synth = this.activeNotes.get(oldestNote)!
      this.activeNotes.delete(oldestNote)
      this.activeNotes.set(midi, synth)
      return synth
    }

    return null
  }
}

// Singleton instance
let pianoInstance: GrandPianoSynth | null = null

/**
 * Get or create the global grand piano instance
 */
export function getGrandPiano(config?: GrandPianoConfig): GrandPianoSynth {
  if (!pianoInstance) {
    pianoInstance = new GrandPianoSynth(config)
  }
  return pianoInstance
}

/**
 * Reset the global piano instance
 */
export function resetGrandPiano(): void {
  if (pianoInstance) {
    pianoInstance.dispose()
    pianoInstance = null
  }
}
