'use client';

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Play, Pause, RotateCcw, Microscope as Metronome, Repeat, X, Volume2 } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import type { LoopRange } from "./types"

interface TransportControlsProps {
  isComplete: boolean
  isPlaying: boolean
  playbackTime: number
  playbackDuration: number
  tempo: number
  metronomeOn: boolean
  currentLoop: LoopRange | null
  onPlayPause: () => void
  onReset: () => void
  onMetronomeToggle: () => void
  onTempoChange: (value: number) => void
  onClearLoop: () => void
  onSeek: (seconds: number) => void
  onTestTone?: () => Promise<void>
}

/** Format seconds as m:ss */
function formatTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function TransportControls({
  isComplete,
  isPlaying,
  playbackTime,
  playbackDuration,
  tempo,
  metronomeOn,
  currentLoop,
  onPlayPause,
  onReset,
  onMetronomeToggle,
  onTempoChange,
  onClearLoop,
  onSeek,
  onTestTone,
}: TransportControlsProps) {
  const [isTestingTone, setIsTestingTone] = useState(false)

  // Scrubbing state: while the user is dragging, we show their drag position
  // instead of the live engine position, and commit on release.
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubValue, setScrubValue] = useState(0)

  const handleTestTone = async () => {
    if (!onTestTone) return
    setIsTestingTone(true)
    try {
      await onTestTone()
    } catch (err) {
      console.error("Test tone failed:", err)
    } finally {
      setIsTestingTone(false)
    }
  }

  // --- Progress / seek bar handlers ---
  const handleScrubStart = useCallback(() => {
    setIsScrubbing(true)
    setScrubValue(playbackTime)
  }, [playbackTime])

  const handleScrubChange = useCallback((values: number[]) => {
    setScrubValue(values[0])
    if (!isScrubbing) {
      // Direct click (no drag) — seek immediately
      onSeek(values[0])
    }
  }, [isScrubbing, onSeek])

  const handleScrubCommit = useCallback((values: number[]) => {
    onSeek(values[0])
    setIsScrubbing(false)
  }, [onSeek])

  // The displayed position: while scrubbing show the drag value, else live time
  const displayTime = isScrubbing ? scrubValue : playbackTime

  return (
    <div className="space-y-6">
      {/* Loop Status Pill */}
      {currentLoop && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-medium">
            <Repeat className="h-3.5 w-3.5" />
            {'Looping Bars '}{currentLoop.start}{'-'}{currentLoop.end}
            <button
              type="button"
              onClick={onClearLoop}
              className="ml-1 hover:bg-accent/20 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Progress / Seek Bar */}
      <div className="space-y-1">
        <Slider
          value={[displayTime]}
          onValueChange={handleScrubChange}
          onValueCommit={handleScrubCommit}
          onPointerDown={handleScrubStart}
          min={0}
          max={playbackDuration || 1}
          step={0.1}
          disabled={!isComplete}
          className="cursor-pointer"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(playbackDuration)}</span>
        </div>
      </div>

      {/* Main Transport */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          disabled={!isComplete}
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="lg"
          disabled={!isComplete}
          onClick={onPlayPause}
          className="h-12 w-12 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        <Button
          variant={metronomeOn ? "default" : "outline"}
          size="icon"
          disabled={!isComplete}
          onClick={onMetronomeToggle}
        >
          <Metronome className="h-4 w-4" />
        </Button>
        {onTestTone && (
          <Button
            variant="outline"
            size="icon"
            disabled={!isComplete || isTestingTone}
            onClick={handleTestTone}
            title="Test audio by playing C4 for 1 second"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tempo Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Tempo</Label>
          <span className="text-sm font-medium text-foreground">{tempo}%</span>
        </div>
        <Slider
          value={[tempo]}
          onValueChange={([value]) => onTempoChange(value)}
          min={25}
          max={100}
          step={5}
          disabled={!isComplete}
        />
      </div>
    </div>
  )
}
