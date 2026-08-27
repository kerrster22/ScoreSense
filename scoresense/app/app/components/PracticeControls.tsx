'use client';

import React, { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Repeat,
  Hand,
  Trash2,
  Save,
  Eye,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { LoopOption, HandOption, NamedLoop, HandAudioMode, HandVisualMode } from "@/types/practice"

interface PracticeControlsProps {
  isComplete: boolean
  loopSelection: string
  loopOptions: LoopOption[]
  onLoopChange: (value: string) => void
  // Bar-based loop input
  totalBars: number
  onSetBarLoop: (startBar: number, endBar: number) => void
  // Named loops
  namedLoops: NamedLoop[]
  onSaveLoop: (name: string) => void
  onDeleteLoop: (loopId: string) => void
  onSelectNamedLoop: (loop: NamedLoop) => void
  onLoopCurrentBar?: () => void
  currentBar?: number
  // Hand audio/visual modes
  handAudioMode: HandAudioMode
  handVisualMode: HandVisualMode
  onHandAudioModeChange: (mode: HandAudioMode) => void
  onHandVisualModeChange: (mode: HandVisualMode) => void
  // Loop repeat-count (applies to bar/named/timeline loops, not Quick Loop)
  loopRepeatTarget?: number | null
  onLoopRepeatTargetChange?: (target: number | null) => void
  // Auto-increase tempo each successful loop pass
  tempoRampActive?: boolean
  onTempoRampToggle?: () => void
}

const REPEAT_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "∞" },
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 5, label: "5x" },
  { value: 10, label: "10x" },
]

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
  loopOptions,
  onLoopChange,
  totalBars,
  onSetBarLoop,
  namedLoops,
  onSaveLoop,
  onDeleteLoop,
  onSelectNamedLoop,
  onLoopCurrentBar,
  currentBar,
  handAudioMode,
  handVisualMode,
  onHandAudioModeChange,
  onHandVisualModeChange,
  loopRepeatTarget = null,
  onLoopRepeatTargetChange,
  tempoRampActive = false,
  onTempoRampToggle,
}: PracticeControlsProps) {
  const [barStart, setBarStart] = useState("")
  const [barEnd, setBarEnd] = useState("")
  const [loopName, setLoopName] = useState("")
  const [showAdvancedHand, setShowAdvancedHand] = useState(false)
  const [thisBarFeedback, setThisBarFeedback] = useState<string | null>(null)
  const thisBarTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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
          {onLoopCurrentBar && (
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs transition-colors ${thisBarFeedback ? "border-accent text-accent" : ""}`}
              disabled={!isComplete}
              onClick={() => {
                onLoopCurrentBar()
                if (thisBarTimerRef.current) clearTimeout(thisBarTimerRef.current)
                setThisBarFeedback(currentBar != null ? `Bar ${currentBar} ✓` : "✓")
                thisBarTimerRef.current = setTimeout(() => setThisBarFeedback(null), 800)
              }}
            >
              {thisBarFeedback ?? "This bar"}
            </Button>
          )}
        </div>

        {/* Repeat count */}
        {onLoopRepeatTargetChange && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] text-muted-foreground shrink-0">Repeat</span>
            <div className="flex flex-wrap gap-1">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  disabled={!isComplete}
                  onClick={() => onLoopRepeatTargetChange(opt.value)}
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md border transition-colors disabled:opacity-40 ${
                    loopRepeatTarget === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tempo ramp */}
        {onTempoRampToggle && (
          <button
            type="button"
            disabled={!isComplete}
            onClick={onTempoRampToggle}
            title="Automatically speed up by 5% each time the loop repeats"
            className={`mt-2 w-full text-[11px] font-medium px-2 py-1.5 rounded-md border transition-colors disabled:opacity-40 ${
              tempoRampActive
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tempoRampActive ? "Tempo Ramp: On (+5%/pass)" : "Tempo Ramp: Off"}
          </button>
        )}

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

      {/* Hand Controls */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground flex items-center gap-2">
          <Hand className="h-4 w-4" />
          Hand Focus
        </Label>

        {/* Primary 3-way toggle: sets both audio and visual together */}
        <div className="grid grid-cols-3 gap-1">
          {(["left", "both", "right"] as const).map((mode) => {
            const audioMatch = mode === "both" ? "both" : `${mode}-only` as HandAudioMode
            const visualMatch = mode === "both" ? "both" : `${mode}-only` as HandVisualMode
            const isActive = handVisualMode === visualMatch && handAudioMode === audioMatch
            return (
              <button
                key={mode}
                type="button"
                disabled={!isComplete}
                onClick={() => {
                  onHandAudioModeChange(audioMatch)
                  onHandVisualModeChange(visualMatch)
                }}
                className={`text-xs font-semibold py-1.5 rounded-md transition-colors border ${
                  isActive
                    ? mode === "right"
                      ? "bg-pink-500/20 border-pink-500/50 text-pink-400"
                      : mode === "left"
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                      : "bg-accent/20 border-accent/50 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                } disabled:opacity-40`}
              >
                {mode === "left" ? "L Hand" : mode === "right" ? "R Hand" : "Both"}
              </button>
            )
          })}
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          onClick={() => setShowAdvancedHand((v) => !v)}
        >
          {showAdvancedHand ? "▲ Hide advanced" : "▼ Advanced (independent audio/visual)"}
        </button>

        {showAdvancedHand && (
          <div className="grid grid-cols-1 gap-3 pt-1 pl-2 border-l-2 border-border/40">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="h-3 w-3" /> Audio
              </span>
              <div className="flex flex-wrap gap-1">
                {HAND_AUDIO_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={handAudioMode === opt.value ? "default" : "outline"}
                    size="sm"
                    disabled={!isComplete}
                    onClick={() => onHandAudioModeChange(opt.value)}
                    className="text-xs h-6 px-2"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3 w-3" /> Visual
              </span>
              <div className="flex flex-wrap gap-1">
                {HAND_VISUAL_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={handVisualMode === opt.value ? "default" : "outline"}
                    size="sm"
                    disabled={!isComplete}
                    onClick={() => onHandVisualModeChange(opt.value)}
                    className="text-xs h-6 px-2"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
