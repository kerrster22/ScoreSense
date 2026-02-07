# Grand Piano Audio API Reference

## Complete Type-Safe API

### GrandPianoSynth Class

#### Constructor
```typescript
const piano = new GrandPianoSynth(config?: {
  volume?: number       // -60 to 0 dB (default: -8)
  reverbWet?: number   // 0 to 1 (default: 0.3)
  reverbDecay?: number // 0.5 to 10 seconds (default: 3.5)
})
```

#### Initialization (Required)
```typescript
await piano.initialize()
// Must call before any playNote() calls
// Returns Promise<void>
```

#### Playing Notes
```typescript
// Play note by MIDI number (0-127)
piano.playNote(midi: number, options?: {
  velocity?: number    // 0 to 1 (default: 0.8)
  duration?: number | string  // seconds or Tone notation
}): void

// Example:
piano.playNote(60)                    // Middle C, default velocity
piano.playNote(60, { velocity: 0.9 }) // Louder
piano.playNote(60, { duration: 1.5 }) // 1.5 second release
```

#### Releasing Notes
```typescript
// Release specific note
piano.releaseNote(midi: number): void

// Example:
piano.releaseNote(60)  // Stop playing Middle C
```

#### Control Methods
```typescript
// Stop all playing notes
piano.stopAll(): void

// Set master volume in dB
piano.setVolume(dbValue: number): void
// Value is clamped to -60..0

// Get current volume in dB
piano.getVolume(): number

// Set reverb wetness (0=dry, 1=very wet)
piano.setReverbWet(value: number): void
// Value is clamped to 0..1

// Get reverb decay time in seconds
piano.getReverbDecay(): number

// Cleanup (dispose all resources)
piano.dispose(): void
```

#### Sequences
```typescript
// Play a sequence of notes
piano.playSequence(
  midiSequence: number[],
  tempo?: number,        // BPM (default: 120)
  noteLength?: number    // Duration multiplier (default: 0.5)
): Promise<void>

// Example:
await piano.playSequence([60, 62, 64, 65, 67])
await piano.playSequence([60, 62, 64], 90, 0.75)
```

---

## useGrandPiano Hook

#### Initialization
```typescript
const {
  isReady,       // boolean - ready to play?
  error,         // string | null - initialization error
  playNote,      // function - play by MIDI
  playNoteByName,// function - play by name
  releaseNote,   // function - stop note
  stopAll,       // function - emergency stop
  setVolume,     // function - volume control
  getVolume,     // function - get current volume
  setReverbWet,  // function - reverb control
  playSequence   // function - auto-play sequence
} = useGrandPiano()

// Auto-initializes on mount
// Auto-disposes on unmount
```

#### Playing Notes
```typescript
// Play by MIDI number
playNote(midi: number | string, velocity?: number, duration?: number | string): void

// Play by note name
playNoteByName(noteName: string, velocity?: number, duration?: number | string): void

// Examples:
playNote(60)                          // Middle C
playNote("60")                        // Also works (parsed to number)
playNoteByName("C4")                  // Middle C
playNoteByName("C#4", 0.9)            // C#4 louder
playNoteByName("F#3", 0.8, 1.5)       // F#3 with duration
```

#### Note Control
```typescript
// Release specific note by MIDI
releaseNote(midi: number): void

// Stop all notes
stopAll(): void

// Examples:
releaseNote(60)                       // Stop Middle C
stopAll()                             // Emergency stop
```

#### Volume Control
```typescript
// Set master volume in dB
setVolume(dbValue: number): void
// Clamped to -60..0

// Get current volume in dB
const currentVolume = getVolume(): number

// Examples:
setVolume(-6)                         // Medium volume
setVolume(-12)                        // Quieter
console.log(getVolume())              // → -6
```

#### Reverb Control
```typescript
// Set reverb wetness
setReverbWet(value: number): void
// Clamped to 0..1
// 0 = fully dry, 1 = maximum reverb

// Examples:
setReverbWet(0.2)                     // Subtle reverb
setReverbWet(0.5)                     // Heavy reverb
```

#### Sequences
```typescript
// Play a sequence asynchronously
playSequence(
  midiSequence: number[],
  tempo?: number,        // BPM (default: 120)
  noteLength?: number    // Duration factor (default: 0.5)
): Promise<void>

// Examples:
await playSequence([60, 62, 64, 65, 67])
await playSequence([60, 62, 64], 90, 0.75)
```

---

## Utility Functions

### Note Name Conversion
```typescript
import { noteNameToMidi, midiToNoteName } from "../hooks/useGrandPiano"

// Convert note name to MIDI (with validation)
noteNameToMidi(noteName: string): number | null

// Returns null if invalid:
noteNameToMidi("C4")      // → 60
noteNameToMidi("C#4")     // → 61
noteNameToMidi("Bb3")     // → 58 (flat notation)
noteNameToMidi("H4")      // → null (invalid note letter)
noteNameToMidi("C")       // → null (no octave)
noteNameToMidi("C99")     // → null (out of range)

// Convert MIDI to note name
midiToNoteName(midi: number): string

// Always returns valid name:
midiToNoteName(60)        // → "C4"
midiToNoteName(61)        // → "C#4"
midiToNoteName(21)        // → "A0" (lowest piano)
midiToNoteName(108)       // → "C8" (highest piano)
```

---

## PianoSoundProvider Component Props

```typescript
interface PianoSoundProviderProps {
  notes: Note[]                              // Notes to play
  playbackTime: number                       // Current position (seconds)
  isPlaying: boolean                         // Playback active?
  tempo: number                              // BPM (informational)
  handSelection: "both" | "left" | "right"   // Which notes to play
}

// Example usage in TutorialPlayer:
<PianoSoundProvider
  notes={notes}
  playbackTime={playbackTime}
  isPlaying={isPlaying}
  tempo={tempo}
  handSelection={handSelection}
/>
```

---

## Error Handling

All errors are logged to console with clear messages:

```typescript
// Invalid MIDI
playNote(-1)      // ❌ Console: "Invalid MIDI note: -1"
playNote(128)     // ❌ Console: "Invalid MIDI note: 128"

// Invalid note name
playNoteByName("H4")  // ❌ Console: "Invalid note name: H4"

// Not initialized
playNote(60)      // ⚠️ Console: "Piano not initialized"

// Volume out of range
setVolume(-100)   // Volume clamped to -60
setVolume(50)     // Volume clamped to 0
```

---

## MIDI Number Reference

```
Valid Range: 0-127

Piano Range: 21-108
  A0 (21) ... C8 (108)

Common References:
  Middle C:  60 (C4)
  A4 (concert pitch): 69
  C4: 60
  C5: 72
  C3: 48
```

---

## Velocity Reference

```typescript
Velocity: 0.0 to 1.0

// Examples:
playNote(60, 0.0)   // Silent (use releaseNote instead)
playNote(60, 0.3)   // Very soft
playNote(60, 0.5)   // Medium
playNote(60, 0.8)   // Loud (default)
playNote(60, 1.0)   // Maximum
```

---

## Duration Reference

```typescript
// Number: seconds
playNote(60, 0.8, 1.5)     // 1.5 second duration

// Tone Notation (strings):
playNote(60, 0.8, "4n")    // Quarter note
playNote(60, 0.8, "8n")    // Eighth note
playNote(60, 0.8, "16n")   // Sixteenth note
playNote(60, 0.8, "2n")    // Half note
playNote(60, 0.8, "1n")    // Whole note

// With tempo modifier:
playNote(60, 0.8, "4n.")   // Dotted quarter
playNote(60, 0.8, "8n.")   // Dotted eighth
```

---

## Example: Complete Usage

```typescript
"use client"

import { useGrandPiano, noteNameToMidi } from "../hooks/useGrandPiano"

export function MyPianoComponent() {
  const { 
    isReady, 
    playNote, 
    playNoteByName, 
    stopAll, 
    setVolume 
  } = useGrandPiano()

  const playScale = async () => {
    // C Major scale
    const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
    
    for (const note of notes) {
      playNoteByName(note, 0.8, 0.5)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return (
    <div>
      <button onClick={playScale} disabled={!isReady}>
        Play Scale
      </button>
      <button onClick={() => setVolume(-12)}>
        Quiet
      </button>
      <button onClick={() => setVolume(-6)}>
        Normal
      </button>
      <button onClick={stopAll}>
        Stop
      </button>
    </div>
  )
}
```

---

## Singleton Management

```typescript
import { getGrandPiano, resetGrandPiano } from "../lib/grandPiano"

// Get global instance
const piano = getGrandPiano()

// Reset for fresh initialization
resetGrandPiano()
```

---

## Type Definitions

All types are fully documented in source files:
- `GrandPianoConfig` - Constructor options
- `NotePlaybackOptions` - Note play options
- `PianoSoundProviderProps` - Component props

All types prevent invalid usage at compile time.

---

## Complete Type Safety

```typescript
// ✅ Valid (will compile)
playNote(60)
playNote(60, 0.8)
playNote(60, 0.8, 1.5)
playNoteByName("C4")
setVolume(-12)

// ❌ Invalid (compile errors)
playNote("60")              // Expected number
playNote(128)               // Will compile, but runtime error
playNoteByName(60)          // Expected string
setVolume("loud")           // Expected number
```

---

*Complete API Reference v1.0*
*All functions are type-safe and validated*
