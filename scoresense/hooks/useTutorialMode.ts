import { useCallback, useMemo, useState } from "react"
import type { TutorialSegment, TutorialLessonState, TutorialConfig, PlaybackMode } from "@/types/tutorial"
import { initialTutorialState } from "@/types/tutorial"

export const useTutorialMode = (
  segments: TutorialSegment[],
  config: TutorialConfig = {}
) => {
  const [state, setState] = useState<TutorialLessonState>({
    ...initialTutorialState,
    autoAdvance: config.autoAdvance ?? false,
    replaySegment: config.replaySegment ?? false,
  })

  const activeSegment = useMemo(() => {
    if (segments.length === 0) return null
    const index = state.currentSegmentIndex
    if (index < 0 || index >= segments.length) return null
    return segments[index]
  }, [segments, state.currentSegmentIndex])

  const selectSegment = useCallback((segmentId: string) => {
    const idx = segments.findIndex((s) => s.id === segmentId)
    if (idx === -1) return
    setState((prev) => ({
      ...prev,
      currentSegmentIndex: idx,
      selectedSegmentId: segmentId,
      playbackMode: "idle",
    }))
  }, [segments])

  const nextSegment = useCallback(() => {
    setState((prev) => {
      const nextIndex = Math.min(prev.currentSegmentIndex + 1, segments.length - 1)
      const selectedId = segments[nextIndex]?.id ?? null
      return {
        ...prev,
        currentSegmentIndex: nextIndex,
        selectedSegmentId: selectedId,
        playbackMode: "idle",
      }
    })
  }, [segments])

  const prevSegment = useCallback(() => {
    setState((prev) => {
      const prevIndex = Math.max(prev.currentSegmentIndex - 1, 0)
      const selectedId = segments[prevIndex]?.id ?? null
      return {
        ...prev,
        currentSegmentIndex: prevIndex,
        selectedSegmentId: selectedId,
        playbackMode: "idle",
      }
    })
  }, [segments])

  const markComplete = useCallback((segmentId: string) => {
    setState((prev) => ({
      ...prev,
      completedSegmentIds: prev.completedSegmentIds.includes(segmentId)
        ? prev.completedSegmentIds
        : [...prev.completedSegmentIds, segmentId],
    }))
  }, [])

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    setState((prev) => ({ ...prev, playbackMode: mode }))
  }, [])

  const toggleAutoAdvance = useCallback(() => {
    setState((prev) => ({ ...prev, autoAdvance: !prev.autoAdvance }))
  }, [])

  const toggleReplaySegment = useCallback(() => {
    setState((prev) => ({ ...prev, replaySegment: !prev.replaySegment }))
  }, [])

  const resetProgress = useCallback(() => {
    setState((prev) => ({
      ...prev,
      completedSegmentIds: [],
      playbackMode: "idle",
    }))
  }, [])

  const hasNext = useMemo(() => segments.length > state.currentSegmentIndex + 1, [segments.length, state.currentSegmentIndex])
  const hasPrev = useMemo(() => state.currentSegmentIndex > 0, [state.currentSegmentIndex])

  return {
    state,
    activeSegment,
    selectSegment,
    nextSegment,
    prevSegment,
    markComplete,
    setPlaybackMode,
    toggleAutoAdvance,
    toggleReplaySegment,
    resetProgress,
    hasNext,
    hasPrev,
  }
}
