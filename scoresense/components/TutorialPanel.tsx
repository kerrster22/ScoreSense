"use client"

import React, { useRef, useEffect, useState, useMemo } from "react"
import type { TutorialSegment, TutorialLessonState } from "@/types/tutorial"
import type { Note } from "@/app/app/components/types"

// ---------------------------------------------------------------------------
// Tiny canvas thumbnail — piano-roll note density for a single segment
// ---------------------------------------------------------------------------

interface ThumbnailProps {
  notes: Note[]
  startTime: number
  endTime: number
}

function SegmentThumbnail({ notes, startTime, endTime }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 60
    const H = 36
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = "#111113"
    ctx.fillRect(0, 0, W, H)

    const dur = endTime - startTime
    if (dur <= 0) return

    const MIDI_MIN = 36
    const MIDI_MAX = 96

    const segNotes = notes.filter(
      (n) => n.startTime >= startTime - 0.1 && n.startTime < endTime + 0.1
    )

    for (const note of segNotes) {
      const midi = note.midi ?? 60
      const clamped = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi))
      const x = ((note.startTime - startTime) / dur) * W
      const nw = Math.max(1.5, (note.duration / dur) * W)
      const y = (1 - (clamped - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)) * (H - 4) + 2
      const alpha = note.velocity != null ? Math.max(0.4, Math.min(1, note.velocity)) : 0.65

      if (note.hand === "right") {
        ctx.fillStyle = `rgba(236,72,153,${alpha})`
      } else if (note.hand === "left") {
        ctx.fillStyle = `rgba(168,85,247,${alpha})`
      } else {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
      }
      ctx.fillRect(x, y - 1, nw, 2)
    }
  }, [notes, startTime, endTime])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 60, height: 36, display: "block", borderRadius: 4 }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

type TutorialPanelProps = {
  segments: TutorialSegment[]
  notes: Note[]
  tutorialState: TutorialLessonState
  activeSegment: TutorialSegment | null
  playbackTime?: number
  onPlaySegment: (segment: TutorialSegment) => void
  onSelectSegment: (segmentId: string) => void
  onNext: () => void
  onPrev: () => void
  onMarkComplete: (segmentId: string) => void
  onToggleAutoAdvance: () => void
  onToggleReplaySegment: () => void
}

export const TutorialPanel: React.FC<TutorialPanelProps> = ({
  segments,
  notes,
  tutorialState,
  activeSegment,
  playbackTime,
  onPlaySegment,
  onSelectSegment,
  onNext,
  onPrev,
  onMarkComplete,
  onToggleAutoAdvance,
  onToggleReplaySegment,
}) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set())
  const prevCompletedRef = useRef<string[]>([])

  // Auto-scroll active item into view
  useEffect(() => {
    if (!activeSegment || !listRef.current) return
    const el = listRef.current.querySelector(`[data-seg-id="${activeSegment.id}"]`)
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeSegment?.id])

  // Detect newly completed segments and trigger a 600ms pulse
  useEffect(() => {
    const prev = prevCompletedRef.current
    const curr = tutorialState.completedSegmentIds
    const newlyDone = curr.filter((id) => !prev.includes(id))
    if (newlyDone.length === 0) {
      prevCompletedRef.current = curr
      return
    }
    setPulsingIds((existing) => {
      const next = new Set(existing)
      newlyDone.forEach((id) => next.add(id))
      return next
    })
    const timer = setTimeout(() => {
      setPulsingIds((existing) => {
        const next = new Set(existing)
        newlyDone.forEach((id) => next.delete(id))
        return next
      })
    }, 600)
    prevCompletedRef.current = curr
    return () => clearTimeout(timer)
  }, [tutorialState.completedSegmentIds])

  // Streak: how many consecutive completed segments, counting backwards from the most recent
  const streak = useMemo(() => {
    const ids = segments.map((s) => s.id)
    const completed = new Set(tutorialState.completedSegmentIds)
    let count = 0
    for (let i = ids.length - 1; i >= 0; i--) {
      if (completed.has(ids[i])) count++
      else break
    }
    return count
  }, [segments, tutorialState.completedSegmentIds])

  const isCurrentlyPlaying = (seg: TutorialSegment) =>
    activeSegment?.id === seg.id &&
    playbackTime != null &&
    playbackTime >= seg.startTime &&
    playbackTime < seg.endTime

  return (
    <div className="flex flex-col bg-card/50 border border-border/50 rounded-xl overflow-hidden">
      {/* Playlist header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <div className="text-sm font-semibold text-foreground">Practice Playlist</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{segments.length} segments</span>
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                🔥 {streak} in a row
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutoAdvance}
            title="Auto-advance to next segment"
            className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
              tutorialState.autoAdvance
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            ⏭ Auto
          </button>
          <button
            type="button"
            onClick={onToggleReplaySegment}
            title="Loop this segment"
            className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
              tutorialState.replaySegment
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            🔁 Loop
          </button>
        </div>
      </div>

      {/* Segment list */}
      <div ref={listRef} className="overflow-y-auto max-h-[420px]">
        {segments.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Load a piece to see practice segments
          </div>
        )}
        {segments.map((seg, idx) => {
          const isActive = activeSegment?.id === seg.id
          const isCompleted = tutorialState.completedSegmentIds.includes(seg.id)
          const isPulsing = pulsingIds.has(seg.id)
          const isPlaying = isCurrentlyPlaying(seg)
          const dur = seg.endTime - seg.startTime
          const handLabel =
            seg.handFocus === "right"
              ? "R Hand"
              : seg.handFocus === "left"
              ? "L Hand"
              : "Both"

          return (
            <div
              key={seg.id}
              data-seg-id={seg.id}
              className={`flex items-start gap-3 p-3 border-b border-border/30 cursor-pointer transition-all duration-200 group ${
                isPulsing
                  ? "bg-green-500/15 border-l-2 border-l-green-400"
                  : isActive
                  ? "bg-accent/10 border-l-2 border-l-accent"
                  : "hover:bg-secondary/40 border-l-2 border-l-transparent"
              }`}
              onClick={() => onPlaySegment(seg)}
            >
              {/* Thumbnail */}
              <div className="shrink-0 relative">
                <SegmentThumbnail
                  notes={notes}
                  startTime={seg.startTime}
                  endTime={seg.endTime}
                />
                {/* Play overlay on hover or if active */}
                <div
                  className={`absolute inset-0 flex items-center justify-center rounded transition-opacity ${
                    isPlaying
                      ? "opacity-100 bg-black/30"
                      : "opacity-0 group-hover:opacity-100 bg-black/40"
                  }`}
                >
                  {isPlaying ? (
                    <span className="text-white text-[8px] font-bold tracking-wider">▶</span>
                  ) : (
                    <span className="text-white text-[8px]">▶</span>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="text-xs font-medium text-foreground leading-tight">
                    Bars {seg.startMeasure}–{seg.endMeasure}
                    <span className="ml-1 text-muted-foreground font-normal">· {handLabel}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {fmtDur(dur)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {seg.isRepeat && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">
                      Repeat
                    </span>
                  )}
                  {isPlaying ? (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent font-semibold animate-pulse">
                      ▶ Playing
                    </span>
                  ) : isCompleted ? (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                      ✓ Done
                    </span>
                  ) : isActive ? (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent/15 text-accent font-medium">
                      Selected
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground/50">
                      {idx + 1}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer nav */}
      {segments.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40">
          <button
            type="button"
            onClick={onPrev}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">
            {tutorialState.currentSegmentIndex + 1} / {segments.length}
          </span>
          <button
            type="button"
            onClick={onNext}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
