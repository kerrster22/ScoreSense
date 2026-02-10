export type MidiNoteEvent = {
  id: string
  midi: number
  noteName: string
  startTime: number
  duration: number
  velocity?: number
  channel?: number
  track?: number
}

export type XmlNoteEvent = {
  id: string
  midi: number
  noteName: string
  staff?: number
  hand?: "left" | "right"
  voice?: string
  measure?: number
  startTime?: number
  duration?: number
  isGrace?: boolean
  isOrnament?: boolean
  tieGroup?: string
}

export type UnifiedNoteEvent = {
  id: string
  midi: number
  noteName: string
  startTime: number
  duration: number
  hand: "left" | "right"
  staff?: number
  voice?: string
  measure?: number
  velocity?: number
  source: { midiId?: string; xmlId?: string; confidence: number }
}

export type AlignOptions = {
  maxTimeDeltaSec?: number // default 0.35
  chordWindowSec?: number // default 0.02
  preferLongerDuration?: boolean
}
