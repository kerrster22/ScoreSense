"use client"

/**
 * Sampled Piano Audio System
 * 
 * Plays pre-recorded piano samples from Salamander Grand Piano CDN
 * instead of synthesizing sounds. Provides better realism than synthesis.
 */

import { noteNameToMidi, midiToNoteName } from "../hooks/useGrandPiano"

export interface SampledPianoConfig {
  volume?: number // 0 to 1
  samplePath?: string // Path to samples folder (unused, kept for compat)
}

/**
 * Sparse sample URLs for Salamander Grand Piano.
 * We load a subset and find the nearest sample for any given note.
 */
const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/"

const SALAMANDER_NOTES: { name: string; midi: number; file: string }[] = [
  { name: "A0", midi: 21, file: "A0.mp3" },
  { name: "C1", midi: 24, file: "C1.mp3" },
  { name: "D#1", midi: 27, file: "Ds1.mp3" },
  { name: "F#1", midi: 30, file: "Fs1.mp3" },
  { name: "A1", midi: 33, file: "A1.mp3" },
  { name: "C2", midi: 36, file: "C2.mp3" },
  { name: "D#2", midi: 39, file: "Ds2.mp3" },
  { name: "F#2", midi: 42, file: "Fs2.mp3" },
  { name: "A2", midi: 45, file: "A2.mp3" },
  { name: "C3", midi: 48, file: "C3.mp3" },
  { name: "D#3", midi: 51, file: "Ds3.mp3" },
  { name: "F#3", midi: 54, file: "Fs3.mp3" },
  { name: "A3", midi: 57, file: "A3.mp3" },
  { name: "C4", midi: 60, file: "C4.mp3" },
  { name: "D#4", midi: 63, file: "Ds4.mp3" },
  { name: "F#4", midi: 66, file: "Fs4.mp3" },
  { name: "A4", midi: 69, file: "A4.mp3" },
  { name: "C5", midi: 72, file: "C5.mp3" },
  { name: "D#5", midi: 75, file: "Ds5.mp3" },
  { name: "F#5", midi: 78, file: "Fs5.mp3" },
  { name: "A5", midi: 81, file: "A5.mp3" },
  { name: "C6", midi: 84, file: "C6.mp3" },
  { name: "D#6", midi: 87, file: "Ds6.mp3" },
  { name: "F#6", midi: 90, file: "Fs6.mp3" },
  { name: "A6", midi: 93, file: "A6.mp3" },
  { name: "C7", midi: 96, file: "C7.mp3" },
  { name: "D#7", midi: 99, file: "Ds7.mp3" },
  { name: "F#7", midi: 102, file: "Fs7.mp3" },
  { name: "A7", midi: 105, file: "A7.mp3" },
  { name: "C8", midi: 108, file: "C8.mp3" },
]

/** Find the nearest Salamander sample for a given MIDI number */
function findNearestSample(midi: number): { sample: typeof SALAMANDER_NOTES[0]; semitoneDiff: number } {
  let best = SALAMANDER_NOTES[0]
  let bestDiff = Math.abs(midi - best.midi)
  for (const s of SALAMANDER_NOTES) {
    const diff = Math.abs(midi - s.midi)
    if (diff < bestDiff) {
      best = s
      bestDiff = diff
    }
  }
  return { sample: best, semitoneDiff: midi - best.midi }
}

/**
 * Sampled Piano Player using Web Audio API
 * Loads and plays pre-recorded Salamander piano samples from CDN
 */
export class SampledPianPlayer {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private sampleCache: Map<string, AudioBuffer> = new Map()
  private playingNotes: Map<number, AudioBufferSourceNode> = new Map()
  private isInitialized: boolean = false

  constructor(config: SampledPianoConfig = {}) {
    this.setVolume(config.volume ?? 0.7)
  }

  /**
   * Initialize the audio context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize audio context:", error)
      throw error
    }
  }

  /**
   * Load a sample from cache or fetch from CDN
   * Uses the nearest Salamander sample and pitch-shifts via playbackRate
   */
  private async loadSample(noteName: string): Promise<{ buffer: AudioBuffer; playbackRate: number } | null> {
    if (!this.audioContext) {
      console.warn("Audio context not initialized")
      return null
    }

    // Convert note name to MIDI for nearest-sample lookup
    const midi = noteNameToMidi(noteName)
    if (midi === null) {
      console.warn(`Invalid note name: ${noteName}`)
      return null
    }

    const { sample, semitoneDiff } = findNearestSample(midi)
    const cacheKey = sample.file

    // Check cache first
    if (this.sampleCache.has(cacheKey)) {
      return {
        buffer: this.sampleCache.get(cacheKey)!,
        playbackRate: Math.pow(2, semitoneDiff / 12),
      }
    }

    try {
      const url = `${SALAMANDER_BASE_URL}${sample.file}`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`Sample not found on CDN: ${sample.file}`)
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      // Cache it
      this.sampleCache.set(cacheKey, audioBuffer)
      return {
        buffer: audioBuffer,
        playbackRate: Math.pow(2, semitoneDiff / 12),
      }
    } catch (error) {
      console.warn(`Failed to load sample ${sample.file}:`, error)
      return null
    }
  }

  /**
   * Play a note by MIDI number or note name
   */
  async playNote(
    midi: number | string,
    options?: { velocity?: number; duration?: number }
  ): Promise<void> {
    if (!this.isInitialized || !this.audioContext || !this.gainNode) {
      console.warn("Audio system not initialized")
      return
    }

    let noteName: string | null = null

    if (typeof midi === "number") {
      // Validate MIDI
      if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
        console.error(`Invalid MIDI note: ${midi}`)
        return
      }
      noteName = midiToNoteName(midi)
    } else {
      noteName = midi
    }

    // Load the nearest sample from CDN
    const result = await this.loadSample(noteName)
    if (!result) {
      console.warn(`Could not load sample for ${noteName}`)
      return
    }

    const { buffer: audioBuffer, playbackRate } = result

    try {
      // Create source and connect to gain
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.playbackRate.value = playbackRate // pitch-shift to correct note
      source.connect(this.gainNode)

      // Apply velocity if provided
      if (options?.velocity) {
        const velocity = Math.max(0, Math.min(1, options.velocity))
        const oldVolume = this.gainNode.gain.value
        this.gainNode.gain.setValueAtTime(oldVolume * velocity, this.audioContext.currentTime)
      }

      // Play it
      source.start(this.audioContext.currentTime)

      // Store reference to stop later if duration provided
      const midiNum = typeof midi === "number" ? midi : noteNameToMidi(noteName)
      if (midiNum !== null) {
        this.playingNotes.set(midiNum, source)

        // Auto-stop after duration or buffer duration
        const duration = options?.duration ?? audioBuffer.duration
        source.onended = () => {
          this.playingNotes.delete(midiNum)
        }
        source.stop(this.audioContext.currentTime + duration)
      }
    } catch (error) {
      console.error(`Failed to play note ${noteName}:`, error)
    }
  }

  /**
   * Stop a specific note
   */
  stopNote(midi: number): void {
    const source = this.playingNotes.get(midi)
    if (source) {
      try {
        source.stop(this.audioContext?.currentTime ?? 0)
      } catch (e) {
        // Already stopped
      }
      this.playingNotes.delete(midi)
    }
  }

  /**
   * Stop all playing notes
   */
  stopAll(): void {
    this.playingNotes.forEach((source) => {
      try {
        source.stop(this.audioContext?.currentTime ?? 0)
      } catch (e) {
        // Already stopped
      }
    })
    this.playingNotes.clear()
  }

  /**
   * Set master volume (0 to 1)
   */
  setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(clamped, this.audioContext?.currentTime ?? 0)
    }
  }

  /**
   * Get current volume (0 to 1)
   */
  getVolume(): number {
    return this.gainNode?.gain.value ?? 0.7
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopAll()
    this.sampleCache.clear()
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close()
    }
    this.audioContext = null
    this.gainNode = null
    this.isInitialized = false
  }
}

// Singleton instance
let pianoInstance: SampledPianPlayer | null = null

/**
 * Get or create the global sampled piano instance
 */
export function getSampledPiano(config?: SampledPianoConfig): SampledPianPlayer {
  if (!pianoInstance) {
    pianoInstance = new SampledPianPlayer(config)
  }
  return pianoInstance
}

/**
 * Reset the global piano instance
 */
export function resetSampledPiano(): void {
  if (pianoInstance) {
    pianoInstance.dispose()
    pianoInstance = null
  }
}
