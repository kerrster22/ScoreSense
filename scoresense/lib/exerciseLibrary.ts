import type { ExerciseDefinition, ExerciseNote, MobilityTip } from "@/types/exercises"
import { CHORD_QUALITIES, NOTE_NAMES, buildChordDefinition } from "@/lib/chordLibrary"

// Baseline roots for the easy/medium tier — five common practice keys.
const EXERCISE_ROOTS = [0, 2, 5, 7, 10] // C, D, F, G, Bb
// Harder variants are curated to a couple of roots rather than all five, so
// the list stays a manageable, hand-picked set instead of exploding in size.
const HARD_ROOTS = [0, 7] // C, G

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]
const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12]
const HARMONIC_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 11, 12]
const CHROMATIC_STEPS = Array.from({ length: 13 }, (_, i) => i)
const FIVE_FINGER_STEPS = [0, 2, 4, 5, 7, 5, 4, 2, 0]

function stepsToNotes(
  rootMidi: number,
  steps: number[],
  bpm: number,
  hand: "left" | "right",
  startTime = 0
): ExerciseNote[] {
  const secPerBeat = 60 / bpm
  return steps.map((step, i) => ({
    midi: rootMidi + step,
    time: startTime + i * secPerBeat,
    duration: secPerBeat * 0.9,
    hand,
    velocity: 0.75,
  }))
}

/** Ascending then descending (minus the repeated top note) — the standard round-trip practice shape. */
function upAndBack(rootMidi: number, steps: number[], bpm: number, hand: "left" | "right"): ExerciseNote[] {
  const up = stepsToNotes(rootMidi, steps, bpm, hand)
  const down = stepsToNotes(rootMidi, [...steps].slice(0, -1).reverse(), bpm, hand, steps.length * (60 / bpm))
  return [...up, ...down]
}

/** Repeats a one-octave step pattern across multiple octaves, degree-aligned (not just +12 each time). */
function multiOctaveSteps(perOctaveSteps: number[], octaves: number): number[] {
  const withinOctave = perOctaveSteps.slice(0, -1)
  const steps: number[] = []
  for (let o = 0; o < octaves; o++) {
    for (const s of withinOctave) steps.push(s + o * 12)
  }
  steps.push(perOctaveSteps[perOctaveSteps.length - 1] + (octaves - 1) * 12)
  return steps
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

const SCALE_TYPE_STEPS: Record<"major" | "natural-minor" | "harmonic-minor" | "chromatic", number[]> = {
  major: MAJOR_STEPS,
  "natural-minor": NATURAL_MINOR_STEPS,
  "harmonic-minor": HARMONIC_MINOR_STEPS,
  chromatic: CHROMATIC_STEPS,
}
const SCALE_TYPE_LABELS: Record<keyof typeof SCALE_TYPE_STEPS, string> = {
  major: "Major",
  "natural-minor": "Natural Minor",
  "harmonic-minor": "Harmonic Minor",
  chromatic: "Chromatic",
}

export function generateScaleExercise(
  rootPc: number,
  scaleType: keyof typeof SCALE_TYPE_STEPS,
  octaves: 1 | 2 = 1,
  bpm = 100
): ExerciseDefinition {
  const rootMidi = 60 + rootPc
  const steps = multiOctaveSteps(SCALE_TYPE_STEPS[scaleType], octaves)
  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `scale-${rootName}-${scaleType}-${octaves}oct`,
    title: `${rootName} ${SCALE_TYPE_LABELS[scaleType]} Scale (${octaves} octave${octaves > 1 ? "s" : ""})`,
    category: "scale",
    description:
      octaves > 1
        ? "Two octaves up and back, hands separately. Keep the tempo locked through both thumb crossings."
        : "One octave up and back. Keep a steady tempo and an even tone through the thumb crossing.",
    bpm,
    notes: upAndBack(rootMidi, steps, bpm, "right"),
    difficulty: scaleType === "chromatic" ? 3 : octaves > 1 ? 3 : 1,
  }
}

/** Two-note interval study: plays scale degree N together with degree N+gap (3 = a third apart, 6 = a sixth). */
export function generateScaleInIntervalsExercise(rootPc: number, intervalName: "thirds" | "sixths", bpm = 76): ExerciseDefinition {
  const degreeGap = intervalName === "thirds" ? 2 : 5
  const scaleDegrees = MAJOR_STEPS.slice(0, -1) // 7 unique degrees within the octave
  const rootMidi = 60 + rootPc
  const secPerBeat = 60 / bpm
  const notes: ExerciseNote[] = []
  const totalSteps = scaleDegrees.length + 1 // up through the octave and back

  const midiForDegreeStep = (stepIndex: number): number => {
    const idx = stepIndex % scaleDegrees.length
    const oct = Math.floor(stepIndex / scaleDegrees.length)
    return rootMidi + scaleDegrees[idx] + oct * 12
  }

  const emitPair = (stepIndex: number, t: number) => {
    notes.push({ midi: midiForDegreeStep(stepIndex), time: t, duration: secPerBeat * 0.9, hand: "right", velocity: 0.72 })
    notes.push({ midi: midiForDegreeStep(stepIndex + degreeGap), time: t, duration: secPerBeat * 0.9, hand: "right", velocity: 0.72 })
  }

  let t = 0
  for (let i = 0; i < totalSteps; i++) {
    emitPair(i, t)
    t += secPerBeat
  }
  for (let i = totalSteps - 2; i >= 0; i--) {
    emitPair(i, t)
    t += secPerBeat
  }

  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `scale-${intervalName}-${rootName}`,
    title: `${rootName} Major Scale in ${intervalName === "thirds" ? "Thirds" : "Sixths"}`,
    category: "scale",
    description: `Play both notes of each ${intervalName === "thirds" ? "third" : "sixth"} together, keeping the top voice smooth and evenly voiced against the bottom.`,
    bpm,
    notes,
    difficulty: 3,
  }
}

/** Both hands move outward from middle C in contrary motion — a classic technique study. */
export function generateContraryMotionScaleExercise(bpm = 84): ExerciseDefinition {
  const secPerBeat = 60 / bpm
  const notes: ExerciseNote[] = []
  const up = MAJOR_STEPS
  const down = [...MAJOR_STEPS].slice(0, -1).reverse()
  const sequence = [...up, ...down]
  sequence.forEach((step, i) => {
    const t = i * secPerBeat
    notes.push({ midi: 60 + step, time: t, duration: secPerBeat * 0.9, hand: "right", velocity: 0.75 })
    notes.push({ midi: 60 - step, time: t, duration: secPerBeat * 0.9, hand: "left", velocity: 0.75 })
  })
  return {
    id: "scale-contrary-motion-C",
    title: "Contrary Motion Scale (C)",
    category: "scale",
    description: "Both hands start on middle C and move outward in mirror image. Watch for the hands to stay perfectly symmetrical.",
    bpm,
    notes,
    difficulty: 3,
  }
}

// ---------------------------------------------------------------------------
// Arpeggios
// ---------------------------------------------------------------------------

export function generateArpeggioExercise(
  rootPc: number,
  qualityId: "maj" | "min" | "dom7",
  octaves: 1 | 2 = 1,
  bpm = 90
): ExerciseDefinition {
  const quality = CHORD_QUALITIES.find((q) => q.id === qualityId)!
  const rootMidi = 60 + rootPc
  const perOctave = [...quality.intervals, quality.intervals[0] + 12]
  const steps = multiOctaveSteps(perOctave, octaves)
  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `arpeggio-${rootName}-${qualityId}-${octaves}oct`,
    title: `${rootName}${quality.symbolSuffix} Arpeggio (${octaves} octave${octaves > 1 ? "s" : ""})`,
    category: "arpeggio",
    description:
      octaves > 1
        ? "Broken chord across two octaves, up and back — focus on a smooth, unbroken hand shift at the octave."
        : "Broken chord, root position, one octave up and back.",
    bpm,
    notes: upAndBack(rootMidi, steps, bpm, "right"),
    difficulty: octaves > 1 ? 3 : 2,
  }
}

/** Root position, then 1st, then 2nd inversion, arpeggiated in sequence — reuses the Chord Encyclopedia's voicing data. */
export function generateArpeggioInversionsExercise(rootPc: number, qualityId: "maj" | "min", bpm = 84): ExerciseDefinition {
  const quality = CHORD_QUALITIES.find((q) => q.id === qualityId)!
  const def = buildChordDefinition(rootPc, quality)
  const secPerBeat = 60 / bpm
  const notes: ExerciseNote[] = []
  let t = 0
  for (const inversion of def.inversions) {
    for (const midi of inversion.notesMidi) {
      notes.push({ midi, time: t, duration: secPerBeat * 0.85, hand: "right", velocity: 0.75 })
      t += secPerBeat
    }
    notes.push({ midi: inversion.notesMidi[0] + 12, time: t, duration: secPerBeat * 0.85, hand: "right", velocity: 0.75 })
    t += secPerBeat
  }
  return {
    id: `arpeggio-inversions-${def.rootName}-${qualityId}`,
    title: `${def.symbol} Arpeggio — All Inversions`,
    category: "arpeggio",
    description: "Root position, 1st inversion, and 2nd inversion in sequence — builds fluency moving between voicings of the same chord.",
    bpm,
    notes,
    difficulty: 3,
  }
}

// ---------------------------------------------------------------------------
// Finger warm-ups
// ---------------------------------------------------------------------------

export function generateFiveFingerExercise(rootPc: number, bpm = 100): ExerciseDefinition {
  const rootMidi = 60 + rootPc
  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `five-finger-${rootName}`,
    title: `${rootName} Five-Finger Pattern`,
    category: "finger-warmup",
    description: "One finger per note, no thumb-under. Aim for even volume across all five fingers.",
    bpm,
    notes: stepsToNotes(rootMidi, FIVE_FINGER_STEPS, bpm, "right"),
    difficulty: 1,
  }
}

// Three distinct Hanon-style cells (inspired by the classic public-domain
// exercises, not literal transcriptions), each transposed diatonically up
// the major scale through an octave-plus and back — the same "move the
// pattern up one scale degree at a time" structure that makes real Hanon
// exercises both long and progressively reach further up the keyboard.
const HANON_CELLS: { cell: number[]; label: string }[] = [
  { cell: [0, 4, 5, 7, 9, 7, 5, 4], label: "1" },
  { cell: [0, 4, 5, 9, 7, 9, 5, 4], label: "2" },
  { cell: [0, 5, 4, 7, 9, 7, 4, 5], label: "3" },
]

export function generateHanonExercise(rootPc: number, variant: "1" | "2" | "3", bpm = 100): ExerciseDefinition {
  const def = HANON_CELLS.find((h) => h.label === variant)!
  const rootMidi = 60 + rootPc
  const secPerBeat = 60 / bpm
  const notes: ExerciseNote[] = []
  const positions = 8
  const degreeStartMidi = (pos: number) => rootMidi + MAJOR_STEPS[pos % 7] + 12 * Math.floor(pos / 7)

  let t = 0
  for (let pos = 0; pos < positions; pos++) {
    const base = degreeStartMidi(pos)
    for (const step of def.cell) {
      notes.push({ midi: base + step, time: t, duration: secPerBeat * 0.85, hand: "right", velocity: 0.75 })
      t += secPerBeat
    }
  }
  for (let pos = positions - 2; pos >= 0; pos--) {
    const base = degreeStartMidi(pos)
    for (const step of def.cell) {
      notes.push({ midi: base + step, time: t, duration: secPerBeat * 0.85, hand: "right", velocity: 0.75 })
      t += secPerBeat
    }
  }

  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `hanon-${variant}-${rootName}`,
    title: `Hanon-Style No. ${variant} (${rootName})`,
    category: "finger-warmup",
    description: "A finger-independence figure inspired by the classic Hanon exercises, walked up the scale a step at a time. Keep wrists loose throughout.",
    bpm,
    notes,
    difficulty: 3,
  }
}

// ---------------------------------------------------------------------------
// Hand independence
// ---------------------------------------------------------------------------

const HAND_INDEPENDENCE_STEPS = [0, 2, 4, 5, 7, 9, 7, 5, 4, 2, 0, 2, 4, 5, 7, 9]

export function generateHandIndependenceExercise(
  rootPc: number,
  variant: "steady" | "waltz-bass" = "steady",
  bpm = 90
): ExerciseDefinition {
  const secPerBeat = 60 / bpm
  const lhRootMidi = 36 + rootPc
  const lhFifthMidi = lhRootMidi + 7
  const rhRootMidi = 60 + rootPc
  const notes: ExerciseNote[] = []

  HAND_INDEPENDENCE_STEPS.forEach((step, i) => {
    notes.push({ midi: rhRootMidi + step, time: i * secPerBeat, duration: secPerBeat * 0.9, hand: "right", velocity: 0.75 })
  })

  if (variant === "waltz-bass") {
    HAND_INDEPENDENCE_STEPS.forEach((_, i) => {
      const midi = i % 2 === 0 ? lhRootMidi : lhFifthMidi
      notes.push({ midi, time: i * secPerBeat, duration: secPerBeat * 0.85, hand: "left", velocity: 0.65 })
    })
  } else {
    HAND_INDEPENDENCE_STEPS.forEach((_, i) => {
      notes.push({ midi: lhRootMidi, time: i * secPerBeat, duration: secPerBeat * 0.9, hand: "left", velocity: 0.65 })
    })
  }

  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `hand-independence-${variant}-${rootName}`,
    title: variant === "waltz-bass" ? `Hand Independence — Waltz Bass (${rootName})` : `Hand Independence (${rootName})`,
    category: "hand-independence",
    description:
      variant === "waltz-bass"
        ? "Left hand alternates root and fifth (an \"oom-pah\" bass) while the right hand moves through a longer melodic pattern."
        : "Left hand holds a steady pulse while the right hand moves through a pattern — resist letting the right hand's rhythm bleed into the left.",
    bpm,
    notes,
    difficulty: variant === "waltz-bass" ? 3 : 2,
  }
}

// ---------------------------------------------------------------------------
// Rhythm training
// ---------------------------------------------------------------------------

type RhythmPattern = "quarter" | "eighth" | "triplet" | "syncopated" | "dotted"

const RHYTHM_LABELS: Record<RhythmPattern, string> = {
  quarter: "Quarter notes",
  eighth: "Eighth notes",
  triplet: "Eighth-note triplets",
  syncopated: "Syncopation",
  dotted: "Dotted rhythms",
}

export function generateRhythmExercise(pattern: RhythmPattern, bpm = 90): ExerciseDefinition {
  const secPerBeat = 60 / bpm
  const totalBeats = 16
  const notes: ExerciseNote[] = []
  const push = (t: number, dur: number, vel: number) =>
    notes.push({ midi: 60, time: t, duration: dur, hand: "right", velocity: vel })

  if (pattern === "syncopated") {
    // Long-short-long "push" feel across each pair of beats: on-beat, the
    // "and" of beat 1, then back on-beat — the classic syncopation cell.
    for (let b = 0; b < totalBeats; b += 2) {
      push(b * secPerBeat, secPerBeat * 0.7, 0.85)
      push((b + 0.75) * secPerBeat, secPerBeat * 0.7, 0.6)
      push((b + 1.5) * secPerBeat, secPerBeat * 0.7, 0.85)
    }
  } else if (pattern === "dotted") {
    for (let b = 0; b < totalBeats; b++) {
      push(b * secPerBeat, secPerBeat * 0.7, 0.85)
      push((b + 0.75) * secPerBeat, secPerBeat * 0.2, 0.6)
    }
  } else {
    const stepsPerBeat = pattern === "quarter" ? 1 : pattern === "eighth" ? 2 : 3
    const stepSec = secPerBeat / stepsPerBeat
    for (let i = 0; i < totalBeats * stepsPerBeat; i++) {
      push(i * stepSec, stepSec * 0.85, i % stepsPerBeat === 0 ? 0.9 : 0.6)
    }
  }

  const difficulty: 1 | 2 | 3 = pattern === "quarter" ? 1 : pattern === "eighth" ? 2 : 3
  return {
    id: `rhythm-${pattern}`,
    title: `${RHYTHM_LABELS[pattern]} @ ${bpm} BPM`,
    category: "rhythm",
    description:
      pattern === "syncopated"
        ? "Push against the beat, landing off the downbeat on purpose — don't let it drift back into straight quarters."
        : pattern === "dotted"
        ? "Long-short, long-short — the short note should feel like it's snapping back onto the beat, not late."
        : "Play along with the metronome, landing exactly on each subdivision.",
    bpm,
    notes,
    difficulty,
  }
}

// ---------------------------------------------------------------------------
// Library assembly
// ---------------------------------------------------------------------------

export function getExerciseLibrary(): Record<ExerciseDefinition["category"], ExerciseDefinition[]> {
  return {
    "finger-warmup": [
      ...EXERCISE_ROOTS.map((r) => generateFiveFingerExercise(r)),
      ...HARD_ROOTS.flatMap((r) => (["1", "2", "3"] as const).map((v) => generateHanonExercise(r, v))),
    ],
    scale: [
      ...EXERCISE_ROOTS.map((r) => generateScaleExercise(r, "major", 1)),
      ...EXERCISE_ROOTS.map((r) => generateScaleExercise(r, "natural-minor", 1)),
      ...HARD_ROOTS.map((r) => generateScaleExercise(r, "major", 2)),
      ...HARD_ROOTS.map((r) => generateScaleExercise(r, "harmonic-minor", 2)),
      generateScaleExercise(0, "chromatic", 1),
      ...HARD_ROOTS.map((r) => generateScaleInIntervalsExercise(r, "thirds")),
      generateScaleInIntervalsExercise(0, "sixths"),
      generateContraryMotionScaleExercise(),
    ],
    arpeggio: [
      ...EXERCISE_ROOTS.flatMap((r) => [
        generateArpeggioExercise(r, "maj", 1),
        generateArpeggioExercise(r, "min", 1),
        generateArpeggioExercise(r, "dom7", 1),
      ]),
      ...HARD_ROOTS.flatMap((r) => [generateArpeggioExercise(r, "maj", 2), generateArpeggioExercise(r, "min", 2)]),
      ...HARD_ROOTS.map((r) => generateArpeggioInversionsExercise(r, "maj")),
      generateArpeggioInversionsExercise(0, "min"),
    ],
    rhythm: [
      generateRhythmExercise("quarter"),
      generateRhythmExercise("eighth"),
      generateRhythmExercise("triplet"),
      generateRhythmExercise("syncopated"),
      generateRhythmExercise("dotted"),
    ],
    "hand-independence": [
      ...EXERCISE_ROOTS.map((r) => generateHandIndependenceExercise(r, "steady")),
      ...HARD_ROOTS.map((r) => generateHandIndependenceExercise(r, "waltz-bass")),
    ],
  }
}

export const MOBILITY_TIPS: MobilityTip[] = [
  {
    id: "wrist",
    title: "Wrist relaxation",
    tip: "Shake out your wrists for 10 seconds and let them hang loose before you start.",
  },
  {
    id: "forearm",
    title: "Forearm release",
    tip: "Rest a forearm on your leg and gently stretch the fingers back with the other hand, 10 seconds each side.",
  },
  {
    id: "shoulders",
    title: "Shoulder check",
    tip: "Roll your shoulders back twice. If they creep up toward your ears while you play, pause and reset.",
  },
]
