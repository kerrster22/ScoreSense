'use client';

import React, { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Repeat,
  Hand,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { LoopOption, HandOption, NamedLoop, HandAudioMode, HandVisualMode } from "./types"

interface PracticeControlsProps {
  isComplete: boolean
  loopSelection: string
  handSelection: string
  loopOptions: LoopOption[]
  handOptions: HandOption[]
  onLoopChange: (value: string) => void
  onHandChange: (value: string) => void
  // Bar-based loop input
  totalBars: number
  onSetBarLoop: (startBar: number, endBar: number) => void
  // Named loops
  namedLoops: NamedLoop[]
  onSaveLoop: (name: string) => void
  onDeleteLoop: (loopId: string) => void
  onSelectNamedLoop: (loop: NamedLoop) => void
  // Hand audio/visual modes
  handAudioMode: HandAudioMode
  handVisualMode: HandVisualMode
  onHandAudioModeChange: (mode: HandAudioMode) => void
  onHandVisualModeChange: (mode: HandVisualMode) => void
}

const HAND_AUDIO_OPTIONS: { value: HandAudioMode; label: string; icon: React.ReactNode }[] = [
  { value: "both", label: "Both", icon: <Volume2 className="h-3 w-3" /> },
  { value: "right-only", label: "R only", icon: <Volume2 className="h-3 w-3" /> },
  { value: "left-only", label: "L only", icon: <Volume2 className="h-3 w-3" /> },
  { value: "mute-right", label: "Mute R", icon: <VolumeX className="h-3 w-3" /> },
  { value: "mute-left", label: "Mute L", icon: <VolumeX className="h-3 w-3" /> },
]

const HAND_VISUAL_OPTIONS: { value: HandVisualMode; label: string }[] = [
  { value: "both", label: "Show Both" },
  { value: "right-only", label: "Show R" },
  { value: "left-only", label: "Show L" },
]

export function PracticeControls({
  isComplete,
  loopSelection,
  handSelection,
  loopOptions,
  handOptions,
  onLoopChange,
  onHandChange,
  totalBars,
  onSetBarLoop,
  namedLoops,
  onSaveLoop,
  onDeleteLoop,
  onSelectNamedLoop,
  handAudioMode,
  handVisualMode,
  onHandAudioModeChange,
  onHandVisualModeChange,
}: PracticeControlsProps) {
  const [barStart, setBarStart] = useState("")
  const [barEnd, setBarEnd] = useState("")
  const [loopName, setLoopName] = useState("")

  const handleBarLoopSubmit = useCallback(() => {
    const s = parseInt(barStart, 10)
    const e = parseInt(barEnd, 10)
    if (isNaN(s) || isNaN(e) || s < 1 || e < s || e > totalBars) return
    onSetBarLoop(s, e)
    setBarStart("")
    setBarEnd("")
  }, [barStart, barEnd, totalBars, onSetBarLoop])

  const handleSaveLoop = useCallback(() => {
    const name = loopName.trim() || `Loop ${namedLoops.length + 1}`
    onSaveLoop(name)
    setLoopName("")
  }, [loopName, namedLoops.length, onSaveLoop])

  return (
    <div className="space-y-4">
      {/* Loop Controls */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Loop
        </Label>
        <div className="flex flex-wrap gap-1">
          {loopOptions.map((option) => (
            <Button
              key={option.value}
              variant={loopSelection === option.value ? "default" : "outline"}
              size="sm"
              disabled={!isComplete}
              onClick={() => onLoopChange(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Bar-based loop input */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            min={1}
            max={totalBars}
            placeholder="Start"
            value={barStart}
            onChange={(e) => setBarStart(e.target.value)}
            disabled={!isComplete}
            className="w-16 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="number"
            min={1}
            max={totalBars}
            placeholder="End"
            value={barEnd}
            onChange={(e) => setBarEnd(e.target.value)}
            disabled={!isComplete}
            className="w-16 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground placeholder:text-muted-foreground"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!isComplete}
            onClick={handleBarLoopSubmit}
          >
            Set
          </Button>
        </div>

        {/* Save current loop */}
        {loopSelection !== "off" && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              placeholder="Loop name..."
              value={loopName}
              onChange={(e) => setLoopName(e.target.value)}
              className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground placeholder:text-muted-foreground"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSaveLoop}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        )}

        {/* Named loops */}
        {namedLoops.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {namedLoops.map((loop) => (
              <div key={loop.id} className="flex items-center gap-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  disabled={!isComplete}
                  onClick={() => onSelectNamedLoop(loop)}
                >
                  {loop.name}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                    {loop.startBar}-{loop.endBar}
                  </Badge>
                </Button>
                <button
                  type="button"
                  onClick={() => onDeleteLoop(loop.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                  aria-label={`Delete loop ${loop.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hand Audio & Visual Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Audio hand mode */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Audio Hand
          </Label>
          <div className="flex flex-wrap gap-1">
            {HAND_AUDIO_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={handAudioMode === opt.value ? "default" : "outline"}
                size="sm"
                disabled={!isComplete}
                onClick={() => onHandAudioModeChange(opt.value)}
                className="text-xs"
              >
                {opt.icon}
                <span className="ml-1">{opt.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Visual hand mode */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Visual Hand
          </Label>
          <div className="flex flex-wrap gap-1">
            {HAND_VISUAL_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={handVisualMode === opt.value ? "default" : "outline"}
                size="sm"
                disabled={!isComplete}
                onClick={() => onHandVisualModeChange(opt.value)}
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
