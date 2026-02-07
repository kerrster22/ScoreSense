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
  type: "exact" | "left-hand" | "transposed"
  loopStart: number
  loopEnd: number
}

export interface LoopRange {
  start: number
  end: number
}
