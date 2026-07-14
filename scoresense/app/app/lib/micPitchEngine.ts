"use client"

import * as Tone from "tone"
import { PitchDetector } from "pitchy"
import { midiToNoteName } from "./piano"

export type MicPitchState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "listening" }
  | { status: "error"; message: string }

export interface MicPitchReading {
  frequencyHz: number
  midi: number
  noteName: string
  /** Signed cents offset from the nearest note (-50..50). */
  cents: number
  /** 0..1 — how confident the McLeod Pitch Method is in this reading. */
  clarity: number
}

const FFT_SIZE = 2048
// MPM's own clarity threshold — below this, findPitch reports [0, 0] and
// we treat it as silence/noise rather than a wrong-but-confident pitch.
const CLARITY_THRESHOLD = 0.9
const MIN_VOLUME_DECIBELS = -45

function frequencyToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

/**
 * Captures the microphone via Tone's audio graph (already used everywhere
 * else in the app) and runs the McLeod Pitch Method (via the `pitchy`
 * library) on the live waveform to estimate frequency + confidence, frame by
 * frame. Deliberately does *not* do onset detection or note-event logic
 * itself — that's a separate concern, layered on top in useMicInput.ts.
 */
export class MicPitchEngine {
  private mic: Tone.UserMedia | null = null
  private analyser: Tone.Analyser | null = null
  private detector: PitchDetector<Float32Array> | null = null
  private rafId: number | null = null
  private state: MicPitchState = { status: "idle" }
  private stateListeners = new Set<(state: MicPitchState) => void>()
  private readingListeners = new Set<(reading: MicPitchReading | null, levelRms: number) => void>()

  getState(): MicPitchState {
    return this.state
  }

  onStateChange(cb: (state: MicPitchState) => void): () => void {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  /** Fires every animation frame while listening, with the current reading (or null) and RMS level (0..1). */
  onReading(cb: (reading: MicPitchReading | null, levelRms: number) => void): () => void {
    this.readingListeners.add(cb)
    return () => this.readingListeners.delete(cb)
  }

  private setState(state: MicPitchState): void {
    this.state = state
    for (const l of this.stateListeners) l(state)
  }

  async start(): Promise<void> {
    if (this.state.status === "listening" || this.state.status === "requesting") return
    if (typeof window === "undefined" || !Tone.UserMedia.supported) {
      this.setState({ status: "error", message: "Your browser doesn't support microphone input." })
      return
    }
    this.setState({ status: "requesting" })
    try {
      await Tone.start()
      const mic = new Tone.UserMedia()
      await mic.open()
      const analyser = new Tone.Analyser("waveform", FFT_SIZE)
      mic.connect(analyser)
      const detector = PitchDetector.forFloat32Array(FFT_SIZE)
      detector.clarityThreshold = CLARITY_THRESHOLD
      detector.minVolumeDecibels = MIN_VOLUME_DECIBELS

      this.mic = mic
      this.analyser = analyser
      this.detector = detector
      this.setState({ status: "listening" })
      this.loop()
    } catch {
      this.setState({ status: "error", message: "Microphone permission was denied, or no microphone is available." })
    }
  }

  stop(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.mic?.close()
    this.mic?.dispose()
    this.analyser?.dispose()
    this.mic = null
    this.analyser = null
    this.detector = null
    for (const l of this.readingListeners) l(null, 0)
    this.setState({ status: "idle" })
  }

  private loop = (): void => {
    if (this.state.status !== "listening" || !this.analyser || !this.detector) return
    const data = this.analyser.getValue() as Float32Array

    let sumSquares = 0
    for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i]
    const levelRms = Math.sqrt(sumSquares / data.length)

    const [freq, clarity] = this.detector.findPitch(data, Tone.getContext().sampleRate)
    if (freq > 0 && clarity >= CLARITY_THRESHOLD) {
      const midiFloat = frequencyToMidiFloat(freq)
      const midi = Math.round(midiFloat)
      const cents = Math.round((midiFloat - midi) * 100)
      const reading: MicPitchReading = { frequencyHz: freq, midi, noteName: midiToNoteName(midi), cents, clarity }
      for (const l of this.readingListeners) l(reading, levelRms)
    } else {
      for (const l of this.readingListeners) l(null, levelRms)
    }

    this.rafId = requestAnimationFrame(this.loop)
  }
}
