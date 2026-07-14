'use client';

import { Button } from "@/components/ui/button"
import { Microscope as Metronome } from "lucide-react"
import type { LoopRange } from "./types"

interface TransportControlsProps {
  isComplete: boolean
  metronomeOn: boolean
  onMetronomeToggle: () => void
  countInEnabled?: boolean
  onCountInToggle?: () => void
  /** 0..1 phase within the current beat, for a visual metronome pulse dot. */
  beatPhase?: number
  // kept in interface for backwards-compat but unused in this component now
  isPlaying?: boolean
  playbackTime?: number
  playbackDuration?: number
  tempo?: number
  currentLoop?: LoopRange | null
  onPlayPause?: () => void
  onReset?: () => void
  onTempoChange?: (value: number) => void
  onClearLoop?: () => void
  onSeek?: (seconds: number) => void
  onTestTone?: () => Promise<void>
}

export function TransportControls({
  isComplete,
  metronomeOn,
  onMetronomeToggle,
  countInEnabled = false,
  onCountInToggle,
  beatPhase = 0,
}: TransportControlsProps) {
  const beatFlash = metronomeOn ? Math.max(0, 1 - beatPhase * 4) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground flex-1">Metronome</span>
        {metronomeOn && (
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-primary"
            style={{
              opacity: 0.35 + beatFlash * 0.65,
              transform: `scale(${1 + beatFlash * 0.6})`,
            }}
          />
        )}
        <Button
          variant={metronomeOn ? "default" : "outline"}
          size="sm"
          disabled={!isComplete}
          onClick={onMetronomeToggle}
          className="gap-1.5 text-xs"
        >
          <Metronome className="h-3.5 w-3.5" />
          {metronomeOn ? "On" : "Off"}
        </Button>
      </div>
      {onCountInToggle && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-1">Count-in (4 beats)</span>
          <Button
            variant={countInEnabled ? "default" : "outline"}
            size="sm"
            disabled={!isComplete}
            onClick={onCountInToggle}
            className="gap-1.5 text-xs"
          >
            {countInEnabled ? "On" : "Off"}
          </Button>
        </div>
      )}
    </div>
  )
}
