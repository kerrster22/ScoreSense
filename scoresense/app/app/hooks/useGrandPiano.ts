"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { GrandPianoSynth, getGrandPiano, resetGrandPiano } from "../lib/grandPiano"

/**
 * Hook for managing grand piano audio playback
 * Type-safe and handles all initialization and cleanup
 */
export function useGrandPiano() {
  const pianoRef = useRef<GrandPianoSynth | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize piano on first mount
  useEffect(() => {
    const initializePiano = async () => {
      try {
        const piano = getGrandPiano({
          volume: -6,
          reverbWet: 0.35,
          reverbDecay: 3.2,
        })
        pianoRef.current = piano
        await piano.initialize()
        setIsReady(true)
        setError(null)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        console.error("Piano initialization error:", errorMsg)
        setError(errorMsg)
      }
    }

    initializePiano()

    // Cleanup on unmount
    return () => {
      if (pianoRef.current) {
        pianoRef.current.dispose()
        resetGrandPiano()
        pianoRef.current = null
      }
    }
  }, [])

  // Type-safe note playing function
  const playNote = useCallback(
    (midi: number | string, velocity?: number, duration?: number | string) => {
      if (!isReady || !pianoRef.current) {
        console.warn("Piano not ready")
        return
      }

      // Handle string input for MIDI (e.g., "C4" would need conversion first)
      let midiNum = typeof midi === "number" ? midi : parseInt(midi, 10)

      if (Number.isNaN(midiNum) || midiNum < 0 || midiNum > 127) {
        console.error(`Invalid MIDI number: ${midi}`)
        return
      }

      pianoRef.current.playNote(midiNum, {
        velocity: velocity ? Math.max(0, Math.min(1, velocity)) : 0.8,
        duration: duration,
      })
    },
    [isReady]
  )

  // Play a note name string (e.g., "C4", "F#3")
  const playNoteByName = useCallback(
    (noteName: string, velocity?: number, duration?: number | string) => {
      if (!isReady || !pianoRef.current) {
        console.warn("Piano not ready")
        return
      }

      const midi = noteNameToMidi(noteName)
      if (midi === null) {
        console.error(`Invalid note name: ${noteName}`)
        return
      }

      pianoRef.current.playNote(midi, {
        velocity: velocity ? Math.max(0, Math.min(1, velocity)) : 0.8,
        duration,
      })
    },
    [isReady]
  )

  // Release a specific note
  const releaseNote = useCallback((midi: number) => {
    pianoRef.current?.releaseNote(midi)
  }, [])

  // Stop all notes
  const stopAll = useCallback(() => {
    pianoRef.current?.stopAll()
  }, [])

  // Set master volume (in dB)
  const setVolume = useCallback((dbValue: number) => {
    pianoRef.current?.setVolume(dbValue)
  }, [])

  // Get current volume
  const getVolume = useCallback((): number => {
    return pianoRef.current?.getVolume() ?? 0
  }, [])

  // Set reverb wetness (0-1)
  const setReverbWet = useCallback((value: number) => {
    pianoRef.current?.setReverbWet(value)
  }, [])

  // Play a sequence of notes
  const playSequence = useCallback(
    async (midiSequence: number[], tempo?: number, noteLength?: number) => {
      if (!isReady || !pianoRef.current) {
        console.warn("Piano not ready")
        return
      }
      await pianoRef.current.playSequence(midiSequence, tempo, noteLength)
    },
    [isReady]
  )

  return {
    isReady,
    error,
    playNote,
    playNoteByName,
    releaseNote,
    stopAll,
    setVolume,
    getVolume,
    setReverbWet,
    playSequence,
  }
}

/**
 * Utility: Convert note name string to MIDI number
 * Supports both sharp (#) and flat (b) notation
 * 
 * @param noteName - e.g., "C4", "F#3", "Bb2"
 * @returns MIDI number (0-127) or null if invalid
 */
export function noteNameToMidi(noteName: string): number | null {
  const match = noteName.match(/^([A-G])([#b]?)(-?\d+)$/)
  if (!match) return null

  const notes: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }

  const base = notes[match[1]]
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0
  const octave = parseInt(match[3], 10)

  const midi = (octave + 1) * 12 + base + accidental
  return midi >= 0 && midi <= 127 ? midi : null
}

/**
 * Utility: Convert MIDI number to note name
 * 
 * @param midi - MIDI number (0-127)
 * @returns Note name string (e.g., "C4", "F#3")
 */
export function midiToNoteName(midi: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const octave = Math.floor(midi / 12) - 1
  const note = notes[midi % 12]
  return `${note}${octave}`
}
