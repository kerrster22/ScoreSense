import type { Segment } from "@/app/app/components/types"

export type TutorialSegment = {
  id: string
  title: string
  startTime: number
  endTime: number
  startMeasure: number
  endMeasure: number
  handFocus?: "left" | "right" | "both"
  isRepeat?: boolean
  difficulty?: number
}

export type PlaybackMode = "idle" | "playing" | "paused" | "replay"

export type TutorialLessonState = {
  currentSegmentIndex: number
  selectedSegmentId: string | null
  completedSegmentIds: string[]
  playbackMode: PlaybackMode
  autoAdvance: boolean
  replaySegment: boolean
}

export type TutorialConfig = {
  autoAdvance?: boolean
  replaySegment?: boolean
}

export const initialTutorialState: TutorialLessonState = {
  currentSegmentIndex: 0,
  selectedSegmentId: null,
  completedSegmentIds: [],
  playbackMode: "idle",
  autoAdvance: false,
  replaySegment: false,
}
