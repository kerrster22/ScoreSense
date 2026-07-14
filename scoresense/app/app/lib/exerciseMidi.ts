import { Midi } from "@tonejs/midi"
import type { ExerciseDefinition } from "../../../types/exercises"

/**
 * Serializes a generated warm-up/technique exercise into a real MIDI file
 * (as a blob URL), so it can be loaded through the exact same midiUrl -> parse
 * -> hybrid-align -> score pipeline as any uploaded or library piece. No
 * changes needed anywhere else in that pipeline — an exercise just looks like
 * a very short MIDI file to the rest of the app.
 */
export function exerciseToMidiBlobUrl(exercise: ExerciseDefinition): string {
  const midi = new Midi()
  midi.header.setTempo(exercise.bpm)

  const rightTrack = midi.addTrack()
  rightTrack.name = "Right Hand"
  rightTrack.channel = 0
  const leftTrack = midi.addTrack()
  leftTrack.name = "Left Hand"
  leftTrack.channel = 1

  for (const note of exercise.notes) {
    const track = note.hand === "left" ? leftTrack : rightTrack
    track.addNote({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity ?? 0.75,
    })
  }

  const bytes = midi.toArray()
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: "audio/midi" })
  return URL.createObjectURL(blob)
}
