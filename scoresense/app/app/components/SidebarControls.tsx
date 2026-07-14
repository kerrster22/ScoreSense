"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { TransportControls } from "./TransportControls"
import { PracticeControls } from "./PracticeControls"
import { VisualAidsToggles } from "./VisualAidsToggles"
import { AudioControls } from "./AudioControls"
import { useState } from "react"
import { Settings2, Eye } from "lucide-react"
import type {
  LoopRange,
  LoopOption,
  NamedLoop,
  HandAudioMode,
  HandVisualMode,
} from "./types"

interface SidebarControlsProps {
  // Transport
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
  countInEnabled?: boolean
  onCountInToggle?: () => void
  beatPhase?: number
  onTempoChange: (value: number) => void
  onClearLoop: () => void
  onSeek: (seconds: number) => void
  onTestTone?: () => Promise<void>
  // Practice
  loopSelection: string
  loopOptions: LoopOption[]
  onLoopChange: (value: string) => void
  totalBars: number
  onSetBarLoop: (startBar: number, endBar: number) => void
  onLoopCurrentBar?: () => void
  namedLoops: NamedLoop[]
  onSaveLoop: (name: string) => void
  onDeleteLoop: (loopId: string) => void
  loopRepeatTarget?: number | null
  onLoopRepeatTargetChange?: (target: number | null) => void
  tempoRampActive?: boolean
  onTempoRampToggle?: () => void
  onSelectNamedLoop: (loop: NamedLoop) => void
  handAudioMode: HandAudioMode
  handVisualMode: HandVisualMode
  onHandAudioModeChange: (mode: HandAudioMode) => void
  onHandVisualModeChange: (mode: HandVisualMode) => void
  // Volume
  volume: number
  onVolumeChange: (value: number) => void
  // Visual aids
  showNoteNames: boolean
  showKeyLabels: boolean
  onShowNoteNamesChange: (value: boolean) => void
  onShowKeyLabelsChange: (value: boolean) => void
  colorblindMode?: boolean
  onColorblindModeChange?: (value: boolean) => void
  currentBar?: number
}

export function SidebarControls({
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
  countInEnabled,
  onCountInToggle,
  beatPhase,
  onTempoChange,
  onClearLoop,
  onSeek,
  onTestTone,
  loopSelection,
  loopOptions,
  onLoopChange,
  totalBars,
  onSetBarLoop,
  onLoopCurrentBar,
  namedLoops,
  onSaveLoop,
  onDeleteLoop,
  onSelectNamedLoop,
  loopRepeatTarget,
  onLoopRepeatTargetChange,
  tempoRampActive,
  onTempoRampToggle,
  handAudioMode,
  handVisualMode,
  onHandAudioModeChange,
  onHandVisualModeChange,
  volume,
  onVolumeChange,
  showNoteNames,
  showKeyLabels,
  onShowNoteNamesChange,
  onShowKeyLabelsChange,
  colorblindMode,
  onColorblindModeChange,
  currentBar,
}: SidebarControlsProps) {
  const [showDisplay, setShowDisplay] = useState(false)

  return (
    <div className="space-y-4">
      {/* Metronome Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="px-4 py-3">
          <TransportControls
            isComplete={isComplete}
            metronomeOn={metronomeOn}
            onMetronomeToggle={onMetronomeToggle}
            countInEnabled={countInEnabled}
            onCountInToggle={onCountInToggle}
            beatPhase={beatPhase}
          />
        </CardContent>
      </Card>

      {/* Practice Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Settings2 className="h-4 w-4 text-accent" />
            Practice
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <PracticeControls
            isComplete={isComplete}
            loopSelection={loopSelection}
            loopOptions={loopOptions}
            onLoopChange={onLoopChange}
            totalBars={totalBars}
            onSetBarLoop={onSetBarLoop}
            onLoopCurrentBar={onLoopCurrentBar}
            currentBar={currentBar}
            namedLoops={namedLoops}
            onSaveLoop={onSaveLoop}
            onDeleteLoop={onDeleteLoop}
            onSelectNamedLoop={onSelectNamedLoop}
            loopRepeatTarget={loopRepeatTarget}
            onLoopRepeatTargetChange={onLoopRepeatTargetChange}
            tempoRampActive={tempoRampActive}
            onTempoRampToggle={onTempoRampToggle}
            handAudioMode={handAudioMode}
            handVisualMode={handVisualMode}
            onHandAudioModeChange={onHandAudioModeChange}
            onHandVisualModeChange={onHandVisualModeChange}
          />
          {/* Display sub-section — collapsible */}
          <Separator className="my-3" />
          <button
            type="button"
            onClick={() => setShowDisplay((v) => !v)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={showDisplay}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Display
            </span>
            <span>{showDisplay ? "▲" : "▼"}</span>
          </button>
          {showDisplay && (
            <div className="mt-3 space-y-3">
              <VisualAidsToggles
                showNoteNames={showNoteNames}
                showKeyLabels={showKeyLabels}
                onShowNoteNamesChange={onShowNoteNamesChange}
                onShowKeyLabelsChange={onShowKeyLabelsChange}
                colorblindMode={colorblindMode}
                onColorblindModeChange={onColorblindModeChange}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Volume</span>
                <AudioControls
                  volume={volume}
                  onVolumeChange={onVolumeChange}
                  disabled={!isComplete}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
