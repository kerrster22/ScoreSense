"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MicPitchEngine, type MicPitchReading, type MicPitchState } from "../lib/micPitchEngine"

// Consecutive matching-pitch frames required before a reading counts as a
// deliberate note-on, rather than a transient/attack-noise blip.
const ONSET_STABLE_FRAMES = 3

/**
 * Turns the mic engine's continuous per-frame pitch stream into discrete
 * note-on/note-off events, fed through the exact same `onNote(note, down)`
 * shape the clickable keyboard and QWERTY mapping already use — mic input is
 * just a third producer of that one event stream, not a separate pipeline.
 */
export function useMicInput(onNote: (note: string, down: boolean) => void) {
  const engineRef = useRef<MicPitchEngine | null>(null)
  const [state, setState] = useState<MicPitchState>({ status: "idle" })
  const [reading, setReading] = useState<MicPitchReading | null>(null)
  const [level, setLevel] = useState(0)

  const activeNoteRef = useRef<string | null>(null)
  const stableMidiRef = useRef<number | null>(null)
  const stableFramesRef = useRef(0)
  const onNoteRef = useRef(onNote)
  onNoteRef.current = onNote

  useEffect(() => {
    const engine = new MicPitchEngine()
    engineRef.current = engine

    const offState = engine.onStateChange(setState)
    const offReading = engine.onReading((r, levelRms) => {
      setReading(r)
      setLevel(levelRms)

      if (r) {
        if (r.midi === stableMidiRef.current) {
          stableFramesRef.current++
        } else {
          stableMidiRef.current = r.midi
          stableFramesRef.current = 1
        }
        if (stableFramesRef.current >= ONSET_STABLE_FRAMES && activeNoteRef.current !== r.noteName) {
          if (activeNoteRef.current) onNoteRef.current(activeNoteRef.current, false)
          activeNoteRef.current = r.noteName
          onNoteRef.current(r.noteName, true)
        }
      } else {
        stableMidiRef.current = null
        stableFramesRef.current = 0
        if (activeNoteRef.current) {
          onNoteRef.current(activeNoteRef.current, false)
          activeNoteRef.current = null
        }
      }
    })

    return () => {
      offState()
      offReading()
      engine.stop()
    }
  }, [])

  const start = useCallback(() => {
    engineRef.current?.start()
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    if (activeNoteRef.current) {
      onNoteRef.current(activeNoteRef.current, false)
      activeNoteRef.current = null
    }
  }, [])

  return { state, reading, level, start, stop }
}
