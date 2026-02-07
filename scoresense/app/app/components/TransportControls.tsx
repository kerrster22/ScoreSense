'use client';

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Play, Pause, RotateCcw, Microscope as Metronome, Repeat, X, Volume2 } from "lucide-react"
import { useState } from "react"
import type { LoopRange } from "./types"

interface TransportControlsProps {
  isComplete: boolean
  isPlaying: boolean
  tempo: number
  metronomeOn: boolean
  currentLoop: LoopRange | null
  onPlayPause: () => void
  onReset: () => void
  onMetronomeToggle: () => void
  onTempoChange: (value: number) => void
  onClearLoop: () => void
  onTestTone?: () => Promise<void>
}

export function TransportControls({
  isComplete,
  isPlaying,
  tempo,
  metronomeOn,
  currentLoop,
  onPlayPause,
  onReset,
  onMetronomeToggle,
  onTempoChange,
  onClearLoop,
  onTestTone,
}: TransportControlsProps) {
  const [isTestingTone, setIsTestingTone] = useState(false)

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
  return (
    <div className="space-y-6">
      {/* Loop Status Pill */}
      {currentLoop && (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-medium">
            <Repeat className="h-3.5 w-3.5" />
            Looping Bars {currentLoop.start}-{currentLoop.end}
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
