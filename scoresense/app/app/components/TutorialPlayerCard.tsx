"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react"
import type { TutorialSegment } from "@/types/tutorial"

interface TutorialPlayerCardProps {
  segment: TutorialSegment
  playbackTime: number
  isPlaying: boolean
  hasNext: boolean
  hasPrev: boolean
  preRollSec?: number
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, "0")}`
}

export function TutorialPlayerCard({
  segment,
  playbackTime,
  isPlaying,
  hasNext,
  hasPrev,
  preRollSec = 2,
  onPlayPause,
  onNext,
  onPrev,
  onClose,
}: TutorialPlayerCardProps) {
  const segDuration = segment.endTime - segment.startTime

  // Derive phase from playbackTime relative to segment bounds
  const isInPreRoll  = playbackTime < segment.startTime
  const isInPostRoll = !isInPreRoll && playbackTime >= segment.endTime
  const isPlaying_   = !isInPreRoll && !isInPostRoll   // truly inside the section

  // Progress within the section (0→1)
  const elapsed  = Math.max(0, Math.min(playbackTime - segment.startTime, segDuration))
  const progress = segDuration > 0 ? elapsed / segDuration : 0
  const remaining = segDuration - elapsed

  // Pre-roll countdown
  const preRollRemaining = Math.max(0, segment.startTime - playbackTime)
  const preRollProgress  = preRollSec > 0
    ? Math.max(0, Math.min(1, (preRollSec - preRollRemaining) / preRollSec))
    : 1
  const preRollCount = Math.ceil(preRollRemaining)

  const handLabel =
    segment.handFocus === "right" ? "Right Hand" :
    segment.handFocus === "left"  ? "Left Hand"  : "Both Hands"

  return (
    <div className="rounded-xl border border-accent/40 bg-card/80 backdrop-blur-sm p-4 space-y-3 shadow-lg shadow-accent/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isInPreRoll ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              Get ready…
            </span>
          ) : isInPostRoll ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              Done
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              Now Playing
            </span>
          )}
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
        {isInPreRoll ? (
          <>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="absolute right-0 top-0 h-full rounded-full bg-amber-400/60 transition-all duration-100"
                style={{ width: `${(1 - preRollProgress) * 100}%` }}
              />
            </div>
            <div className="flex justify-center text-[10px] text-amber-400/80 tabular-nums">
              {preRollCount > 0 ? `Starting in ${preRollCount}…` : "Go!"}
            </div>
          </>
        ) : isInPostRoll ? (
          <>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-full rounded-full bg-green-500/50" />
            </div>
            <div className="flex justify-center text-[10px] text-green-400/80">
              ✓ Section complete
            </div>
          </>
        ) : (
          <>
            <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{fmtTime(elapsed)}</span>
              {remaining > 0 && remaining < 4 && (
                <span className="text-accent animate-pulse">Almost there…</span>
              )}
              <span>{fmtTime(segDuration)}</span>
            </div>
          </>
        )}
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
