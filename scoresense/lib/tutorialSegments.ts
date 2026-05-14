import type { TutorialSegment } from "@/types/tutorial"
import type { MeasureMapEntry, MusicXmlNoteEvent } from "@/app/app/lib/musicmxl"
import type { Segment } from "@/app/app/components/types"

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const inferHandFocus = (events: MusicXmlNoteEvent[], startSec: number, endSec: number): "left" | "right" | "both" => {
  const windowEvents = events.filter((e) => e.startTime >= startSec && e.startTime < endSec)
  const leftCount = windowEvents.filter((e) => e.hand === "left").length
  const rightCount = windowEvents.filter((e) => e.hand === "right").length

  if (leftCount === 0 && rightCount === 0) return "both"
  if (leftCount === 0) return "right"
  if (rightCount === 0) return "left"
  return leftCount > rightCount ? "left" : rightCount > leftCount ? "right" : "both"
}

const generateChunkSegmentsFromMeasureMap = (measureMap: MeasureMapEntry[], barsPerChunk = 4): TutorialSegment[] => {
  if (measureMap.length === 0) return []

  const segments: TutorialSegment[] = []
  const totalBars = measureMap.length

  for (let i = 0; i < totalBars; i += barsPerChunk) {
    const startMeasure = measureMap[i].measure
    const endIndex = Math.min(i + barsPerChunk - 1, totalBars - 1)
    const endMeasure = measureMap[endIndex].measure
    const startTime = measureMap[i].startSec
    const endTime = measureMap[endIndex].endSec

    segments.push({
      id: `segment-${startMeasure}-${endMeasure}`,
      title: `Bars ${startMeasure}-${endMeasure}`,
      startTime,
      endTime,
      startMeasure,
      endMeasure,
      handFocus: "both",
      isRepeat: false,
      difficulty: 1,
    })
  }

  return segments
}

export const generateTutorialSegments = (
  existingSegments: Segment[] | null,
  measureMap: MeasureMapEntry[] | null,
  events: MusicXmlNoteEvent[] | null
): TutorialSegment[] => {
  if (existingSegments && existingSegments.length > 0) {
    return existingSegments.map((s, idx) => ({
      id: s.id,
      title: s.title,
      startTime: s.startSec,
      endTime: s.endSec,
      startMeasure: s.startBar,
      endMeasure: s.endBar,
      handFocus: events ? inferHandFocus(events, s.startSec, s.endSec) : "both",
      isRepeat: s.repeatCount > 1,
      difficulty: clamp(1 + Math.floor((s.endBar - s.startBar) / 2), 1, 5),
    }))
  }

  if (measureMap && measureMap.length > 0) {
    const baseSegments = generateChunkSegmentsFromMeasureMap(measureMap, 4)
    return baseSegments.map((s, idx) => ({
      ...s,
      id: s.id || `fallback-segment-${idx}`,
      handFocus: events ? inferHandFocus(events, s.startTime, s.endTime) : "both",
      difficulty: 2,
    }))
  }

  return []
}
