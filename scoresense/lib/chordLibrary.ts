// Canonical chord-definition table shared by chord *detection* (chordDetection.ts),
// the Chord Encyclopedia, and Chord Training mode — one source of truth so
// recognition and the reference material can't drift apart.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export interface ChordQuality {
  id: string
  label: string
  /** Appended to the root name to form a symbol, e.g. "C" + "m7" -> "Cm7". */
  symbolSuffix: string
  /** Ascending semitone intervals from the root, always starting at 0. */
  intervals: number[]
  /** Counted toward the "N / 84 essential chords" headline stat and the encyclopedia's default view. */
  essential: boolean
}

// The 7 "essential" qualities (4 triads + 3 sevenths) x 12 roots = 84 chords —
// matches the illustrative "31 / 84 essential chords" framing from the product brief.
// dim7/m(maj7) are kept for detection accuracy on real repertoire but aren't
// essential/gamified — they're rarer and would muddy the headline stat.
export const CHORD_QUALITIES: ChordQuality[] = [
  { id: "maj",   label: "Major",          symbolSuffix: "",      intervals: [0, 4, 7],      essential: true },
  { id: "min",   label: "Minor",          symbolSuffix: "m",     intervals: [0, 3, 7],      essential: true },
  { id: "dim",   label: "Diminished",     symbolSuffix: "dim",   intervals: [0, 3, 6],      essential: true },
  { id: "aug",   label: "Augmented",      symbolSuffix: "aug",   intervals: [0, 4, 8],      essential: true },
  { id: "dom7",  label: "Dominant 7",     symbolSuffix: "7",     intervals: [0, 4, 7, 10],  essential: true },
  { id: "maj7",  label: "Major 7",        symbolSuffix: "maj7",  intervals: [0, 4, 7, 11],  essential: true },
  { id: "min7",  label: "Minor 7",        symbolSuffix: "m7",    intervals: [0, 3, 7, 10],  essential: true },
  { id: "sus2",  label: "Sus2",           symbolSuffix: "sus2",  intervals: [0, 2, 7],      essential: false },
  { id: "sus4",  label: "Sus4",           symbolSuffix: "sus4",  intervals: [0, 5, 7],      essential: false },
  { id: "dim7",  label: "Diminished 7",   symbolSuffix: "dim7",  intervals: [0, 3, 6, 9],   essential: false },
  { id: "mMaj7", label: "Minor-Major 7",  symbolSuffix: "m(maj7)", intervals: [0, 3, 7, 11], essential: false },
]

export const INVERSION_LABELS = ["Root position", "1st inversion", "2nd inversion", "3rd inversion"]

export interface ChordInversionVoicing {
  inversion: number
  label: string
  /** MIDI notes for one close-position voicing with this inversion's bass note lowest. */
  notesMidi: number[]
}

export interface ChordDefinition {
  id: string
  rootPc: number
  rootName: string
  quality: ChordQuality
  symbol: string
  /** Root-position voicing anchored in the octave starting at C4 (MIDI 60). */
  notesMidi: number[]
  inversions: ChordInversionVoicing[]
}

function rootPositionMidi(rootPc: number, intervals: number[]): number[] {
  const rootMidi = 60 + rootPc // anchor to the octave starting at C4
  return intervals.map((iv) => rootMidi + iv)
}

function buildInversions(rootPc: number, intervals: number[]): ChordInversionVoicing[] {
  const rootMidi = 60 + rootPc
  const base = intervals.map((iv) => rootMidi + iv)
  return intervals.map((_, inversion) => {
    // Rotate: take `inversion` lowest notes and move each up an octave, in order,
    // until the (inversion)-th chord tone is the lowest sounding note.
    const notes = [...base]
    for (let i = 0; i < inversion; i++) notes[i] += 12
    notes.sort((a, b) => a - b)
    return { inversion, label: INVERSION_LABELS[inversion] ?? `${inversion} inversion`, notesMidi: notes }
  })
}

export function buildChordDefinition(rootPc: number, quality: ChordQuality): ChordDefinition {
  const rootName = NOTE_NAMES[rootPc]
  return {
    id: `${rootName}-${quality.id}`,
    rootPc,
    rootName,
    quality,
    symbol: `${rootName}${quality.symbolSuffix}`,
    notesMidi: rootPositionMidi(rootPc, quality.intervals),
    inversions: buildInversions(rootPc, quality.intervals),
  }
}

let cachedAll: ChordDefinition[] | null = null

/** All 12 roots x all qualities (essential + extended) — used by the encyclopedia. */
export function getAllChordDefinitions(): ChordDefinition[] {
  if (cachedAll) return cachedAll
  const defs: ChordDefinition[] = []
  for (let root = 0; root < 12; root++) {
    for (const quality of CHORD_QUALITIES) {
      defs.push(buildChordDefinition(root, quality))
    }
  }
  cachedAll = defs
  return defs
}

/** The 84 "essential" chords (4 triad qualities + 3 seventh qualities x 12 roots). */
export function getEssentialChordDefinitions(): ChordDefinition[] {
  return getAllChordDefinitions().filter((d) => d.quality.essential)
}

const bySymbol = new Map<string, ChordDefinition>()
export function findChordDefinitionBySymbol(symbol: string): ChordDefinition | undefined {
  if (bySymbol.size === 0) {
    for (const def of getAllChordDefinitions()) bySymbol.set(def.symbol, def)
  }
  return bySymbol.get(symbol)
}
