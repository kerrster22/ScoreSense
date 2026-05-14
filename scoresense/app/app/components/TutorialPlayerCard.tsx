"use client"

import React, { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react"
import type { TutorialSegment } from "@/types/tutorial"

interface TutorialPlayerCardProps {
  segment: TutorialSegment
  playbackTime: number
  isPlaying: boolean
  hasNext: boolean
  hasPrev: boolean
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function TutorialPlayerCard({
  segment,
  playbackTime,
  isPlaying,
  hasNext,
  hasPrev,
  onPlayPause,
  onNext,
  onPrev,
  onClose,
}: TutorialPlayerCardProps) {
  const segDuration = segment.endTime - segment.startTime
  const elapsed = Math.max(0, Math.min(playbackTime - segment.startTime, segDuration))
  const progress = segDuration > 0 ? elapsed / segDuration : 0
  const remaining = segDuration - elapsed
  const nearEnd = remaining < 3 && remaining > 0

  const handLabel = segment.handFocus === "right"
    ? "Right Hand"
    : segment.handFocus === "left"
    ? "Left Hand"
    : "Both Hands"

  return (
    <div className="rounded-xl border border-accent/40 bg-card/80 backdrop-blur-sm p-4 space-y-3 shadow-lg shadow-accent/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            Now Playing
          </span>
          <span className="text-xs text-muted-foreground">
            Bars {segment.startMeasure}–{segment.endMeasure} · {handLabel}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>{fmtTime(elapsed)}</span>
          {nearEnd && (
            <span className="text-accent animate-pulse">Up Next →</span>
          )}
          <span>{fmtTime(segDuration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          disabled={!hasPrev}
          onClick={onPrev}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-9 w-9 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={onPlayPause}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          disabled={!hasNext}
          onClick={onNext}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
