"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { SampledPianPlayer, getSampledPiano, resetSampledPiano } from "../lib/sampledPiano"
import { noteNameToMidi } from "./useGrandPiano"

/**
 * Hook for managing sampled piano audio playback
 * Plays real piano samples from MP3 files
 */
export function useSampledPiano() {
  const pianoRef = useRef<SampledPianPlayer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [volume, setVolumeState] = useState(0.7)

  // Initialize piano on first mount
  useEffect(() => {
    const initializePiano = async () => {
      try {
        const piano = getSampledPiano({ volume: 0.7 })
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
        resetSampledPiano()
        pianoRef.current = null
      }
    }
  }, [])

  // Type-safe note playing function
  const playNote = useCallback(
    async (midi: number | string, velocity?: number, duration?: number) => {
      if (!isReady || !pianoRef.current) {
        console.warn("Piano not ready")
        return
      }

      // Validate MIDI if it's a number
      if (typeof midi === "number") {
        if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
          console.error(`Invalid MIDI number: ${midi}`)
          return
        }
      }

      await pianoRef.current.playNote(midi, {
        velocity: velocity ? Math.max(0, Math.min(1, velocity)) : 0.8,
        duration,
      })
    },
    [isReady]
  )

  // Play by note name
  const playNoteByName = useCallback(
    async (noteName: string, velocity?: number, duration?: number) => {
      if (!isReady || !pianoRef.current) {
        console.warn("Piano not ready")
        return
      }

      const midi = noteNameToMidi(noteName)
      if (midi === null) {
        console.error(`Invalid note name: ${noteName}`)
        return
      }

      await pianoRef.current.playNote(noteName, {
        velocity: velocity ? Math.max(0, Math.min(1, velocity)) : 0.8,
        duration,
      })
    },
    [isReady]
  )

  // Stop specific note
  const stopNote = useCallback((midi: number) => {
    pianoRef.current?.stopNote(midi)
  }, [])

  // Stop all notes
  const stopAll = useCallback(() => {
    pianoRef.current?.stopAll()
  }, [])

  // Set master volume (0 to 1)
  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value))
    pianoRef.current?.setVolume(clamped)
    setVolumeState(clamped)
  }, [])

  // Get current volume
  const getVolume = useCallback((): number => {
    return pianoRef.current?.getVolume() ?? 0.7
  }, [])

  return {
    isReady,
    error,
    volume,
    playNote,
    playNoteByName,
    stopNote,
    stopAll,
    setVolume,
    getVolume,
  }
}
