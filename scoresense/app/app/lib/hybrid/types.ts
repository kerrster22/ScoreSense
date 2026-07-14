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
  /** Suggested finger (1-5), when present in the source MusicXML */
  fingering?: number
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
  fingering?: number
  source: {
    midiId?: string
    xmlId?: string
    confidence: number
    /** Which signal `hand` actually came from. */
    handSource?: "midi" | "xml" | "fallback"
  }
}

export type AlignOptions = {
  maxTimeDeltaSec?: number // default 0.35
  chordWindowSec?: number // default 0.02
  preferLongerDuration?: boolean
  /**
   * Per-MIDI-note-id left/right hand guess derived from the MIDI file's own
   * track/channel structure (see handDetection.ts's buildHandAssigner).
   * Returns undefined if the id isn't a known MIDI note.
   */
  midiHandHint?: (midiId: string) => "left" | "right" | undefined
  /**
   * When true, `midiHandHint` wins over the XML score's staff-derived hand
   * for notes that matched an XML note (set this when buildHandAssigner
   * reported "high" confidence — e.g. a clean multi-track/channel split).
   * Unmatched notes always prefer the hint when one is available, regardless
   * of this flag, since XML staff isn't available to compete with it there.
   */
  preferMidiHand?: boolean
}
