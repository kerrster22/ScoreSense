export interface UploadedFile {
  name: string
  size: number
}

export interface Note {
  id: number
  note: string
  hand: "right" | "left"
  startTime: number
  duration: number
}

export interface PianoKey {
  note: string
  isBlack: boolean
}

export interface ConversionStep {
  id: number
  label: string
}

export interface LoopOption {
  value: string
  label: string
}

export interface HandOption {
  value: string
  label: string
}

export interface PatternInsight {
  id: number
  text: string
  barRange: string
  type: "exact" | "left-hand" | "transposed" | "near"
  loopStart: number
  loopEnd: number
  /** Other bar ranges where this pattern also appears */
  occurrences?: string[]
}

export interface LoopRange {
  start: number
  end: number
}

// ---------------------------------------------------------------------------
// Measure map: bar number <-> time
// ---------------------------------------------------------------------------

export interface MeasureInfo {
  /** 1-based measure number from the score */
  measure: number
  /** Playthrough index when a bar occurs more than once (repeats) */
  playthroughIndex: number
  /** Start time in piece-seconds */
  startSec: number
  /** End time in piece-seconds */
  endSec: number
}

// ---------------------------------------------------------------------------
// Named loops (per-piece persistence)
// ---------------------------------------------------------------------------

export interface NamedLoop {
  id: string
  name: string
  startBar: number
  endBar: number
  startSec: number
  endSec: number
}

// ---------------------------------------------------------------------------
// Segments / Chapters / Lessons
// ---------------------------------------------------------------------------

export interface Segment {
  id: string
  title: string
  startBar: number
  endBar: number
  startSec: number
  endSec: number
  /** How many times this phrase repeats (including self) */
  repeatCount: number
  /** Bar ranges of all occurrences (e.g. ["1-8","17-24"]) */
  occurrences: string[]
  /** Similarity score vs other segments (0-1, 1 = identical) */
  similarityScore?: number
}

export interface Lesson {
  id: string
  title: string
  segments: Segment[]
  /** Total duration in seconds */
  durationSec: number
  startSec: number
  endSec: number
}

// ---------------------------------------------------------------------------
// Hand audio/visual modes
// ---------------------------------------------------------------------------

export type HandAudioMode = "both" | "right-only" | "left-only" | "mute-right" | "mute-left"
export type HandVisualMode = "both" | "right-only" | "left-only"

// ---------------------------------------------------------------------------
// Persistence shape
// ---------------------------------------------------------------------------

export interface PiecePersistence {
  pieceHash: string
  namedLoops: NamedLoop[]
  lastPositionSec: number
  cachedAnalysis?: {
    algoVersion: string
    segments: Segment[]
    lessons: Lesson[]
    insights: PatternInsight[]
  }
}
