'use client';

import { Button } from "@/components/ui/button"
import { Microscope as Metronome } from "lucide-react"
import type { LoopRange } from "./types"

interface TransportControlsProps {
  isComplete: boolean
  metronomeOn: boolean
  onMetronomeToggle: () => void
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
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground flex-1">Metronome</span>
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
  )
}
