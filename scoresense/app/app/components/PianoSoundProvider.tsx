"use client"

import React, { useEffect } from "react"
import { useSampledPiano } from "../hooks/useSampledPiano"
import type { Note } from "./types"

/**
 * PianoSoundProvider Component
 * 
 * Synchronizes note playback with the visual piano display.
 * Plays pre-recorded piano samples from public/piano-mp3 folder.
 * 
 * Type-safe: Works with all MIDI numbers (0-127)
 * Edge cases handled:
 * - Note overlaps
 * - Tempo changes during playback
 * - Invalid note names (logged with error messages)
 * - Audio context initialization
 */

interface PianoSoundProviderProps {
  notes: Note[]
  playbackTime: number
  isPlaying: boolean
  tempo: number
  handSelection: "both" | "left" | "right"
}

export function PianoSoundProvider({
  notes,
  playbackTime,
  isPlaying,
  tempo,
  handSelection,
}: PianoSoundProviderProps) {
  const { playNote, stopNote, stopAll, isReady, error } = useSampledPiano()

  // Track which notes are currently playing
  const activeNotesRef = React.useRef<Set<string>>(new Set())
  const noteStartTimesRef = React.useRef<Map<string, number>>(new Map())

  // When playback is not playing, stop all notes
  useEffect(() => {
    if (!isPlaying) {
      stopAll()
      activeNotesRef.current.clear()
      noteStartTimesRef.current.clear()
    }
  }, [isPlaying, stopAll])

  // Main playback effect: trigger notes based on current time
  useEffect(() => {
    if (!isReady || !isPlaying) return

    // Filter notes based on hand selection
    const filteredNotes = notes.filter((note) => {
      if (handSelection === "both") return true
      if (handSelection === "right" && note.hand === "right") return true
      if (handSelection === "left" && note.hand === "left") return true
      return false
    })

    // Find notes that should be playing at current time
    const currentNotes = new Set<string>()
    const notesToPlay: Note[] = []
    const notesToRelease: string[] = []

    filteredNotes.forEach((note) => {
      const noteId = `${note.id}-${note.note}`
      const shouldPlay = playbackTime >= note.startTime && playbackTime < note.startTime + note.duration

      if (shouldPlay) {
        currentNotes.add(noteId)

        // Play note if it wasn't already active
        if (!activeNotesRef.current.has(noteId)) {
          notesToPlay.push(note)
          noteStartTimesRef.current.set(noteId, playbackTime)
        }
      } else if (activeNotesRef.current.has(noteId)) {
        // Release note if it was active but shouldn't be anymore
        notesToRelease.push(noteId)
      }
    })

    // Play new notes asynchronously
    notesToPlay.forEach((note) => {
      const duration = note.duration
      const velocity = duration > 1 ? 0.85 : 0.75

      playNote(note.note, velocity, duration)
      activeNotesRef.current.add(`${note.id}-${note.note}`)
    })

    // Release old notes
    notesToRelease.forEach((noteId) => {
      const [, noteName] = noteId.split("-")
      // For sampled audio, we just let it play to completion
      // The audio engine handles stopping automatically
      activeNotesRef.current.delete(noteId)
      noteStartTimesRef.current.delete(noteId)
    })
  }, [playbackTime, isPlaying, isReady, notes, handSelection, playNote])

  // Log initialization status
  useEffect(() => {
    if (error) {
      console.error("Piano initialization error:", error)
    }
  }, [error])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll()
      activeNotesRef.current.clear()
      noteStartTimesRef.current.clear()
    }
  }, [stopAll])

  return null // This is a non-visual provider component
}
