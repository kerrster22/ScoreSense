"use client"

/**
 * Sampled Piano Audio System
 * 
 * Plays pre-recorded piano samples from the public/piano-mp3 folder
 * instead of synthesizing sounds. Provides better realism than synthesis.
 */

import { noteNameToMidi, midiToNoteName } from "../hooks/useGrandPiano"

export interface SampledPianoConfig {
  volume?: number // 0 to 1
  samplePath?: string // Path to samples folder
}

/**
 * Sampled Piano Player using Web Audio API
 * Loads and plays pre-recorded piano samples
 */
export class SampledPianPlayer {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private sampleCache: Map<string, AudioBuffer> = new Map()
  private playingNotes: Map<number, AudioBufferSourceNode> = new Map()
  private samplePath: string
  private isInitialized: boolean = false

  constructor(config: SampledPianoConfig = {}) {
    this.samplePath = config.samplePath || "/piano-mp3"
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
   * Load a sample from cache or fetch it
   */
  private async loadSample(noteName: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) {
      console.warn("Audio context not initialized")
      return null
    }

    // Check cache first
    if (this.sampleCache.has(noteName)) {
      return this.sampleCache.get(noteName)!
    }

    try {
      const samplePath = `${this.samplePath}/${noteName}.mp3`
      const response = await fetch(samplePath)

      if (!response.ok) {
        console.warn(`Sample not found: ${noteName}`)
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      // Cache it
      this.sampleCache.set(noteName, audioBuffer)
      return audioBuffer
    } catch (error) {
      console.warn(`Failed to load sample ${noteName}:`, error)
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

    // Load the sample
    const audioBuffer = await this.loadSample(noteName)
    if (!audioBuffer) {
      console.warn(`Could not load sample for ${noteName}`)
      return
    }

    try {
      // Create source and connect to gain
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
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
