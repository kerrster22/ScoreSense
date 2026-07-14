export type ExerciseCategory =
  | "finger-warmup"
  | "scale"
  | "arpeggio"
  | "rhythm"
  | "hand-independence"

export interface ExerciseNote {
  midi: number
  time: number
  duration: number
  hand: "left" | "right"
  velocity?: number
}

export interface ExerciseDefinition {
  id: string
  title: string
  category: ExerciseCategory
  description: string
  bpm: number
  notes: ExerciseNote[]
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: 1 | 2 | 3
}

export interface MobilityTip {
  id: string
  title: string
  tip: string
}
